// backend/src/websocket/websocket.gateway.ts (CORRECTED)
import {
  WebSocketGateway as NestWebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ScraperSessionService, ScrapeProgress } from '../modules/scraper/scraper-session.service';

interface WebSocketEvent {
  type: 'NAVIGATE' | 'HOVER' | 'CLICK' | 'LOAD_MORE' | 'GET_DETAILS';
  payload: {
    target: string;
    action: 'hover' | 'click' | 'paginate';
    categorySlug?: string;
    navigationSlug?: string;
  };
}

@NestWebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/api/ws',
})
export class WebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebSocketGateway.name);
  private readonly clientSessions = new Map<string, string>(); // clientId -> sessionId

  constructor(private readonly scraperSessionService: ScraperSessionService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);

    this.clientSessions.set(client.id, client.id);

    // The browser is started on the first action instead of here. Launching one per
    // connection meant two tabs racing two Chromium starts, and a launch that lost that
    // race left the client with no session at all — every later click then quietly served
    // stored data. Readiness is about the client being able to send actions, not about a
    // browser already being warm.
    client.emit('SESSION_READY', {
      type: 'SESSION_READY',
      payload: {
        sessionId: client.id,
        status: 'ready',
        message: 'Interactive scraper session ready',
      },
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    // Clean up scraper session
    const sessionId = this.clientSessions.get(client.id);
    if (sessionId) {
      this.scraperSessionService.cleanupSession(sessionId).catch(error => {
        this.logger.error(`Failed to cleanup session ${sessionId}:`, error);
      });
      this.clientSessions.delete(client.id);
    }
  }

  @SubscribeMessage('NAVIGATE')
  async handleNavigate(
    @MessageBody() event: WebSocketEvent,
    @ConnectedSocket() client: Socket,
  ) {
    const sessionId = this.clientSessions.get(client.id);
    if (!sessionId) {
      client.emit('ERROR', {
        type: 'ERROR',
        payload: { message: 'No active session found' },
      });
      return;
    }

    try {
      const { target, action, categorySlug, navigationSlug } = event.payload;

      switch (action) {
        // Braced so the per-branch `const` is scoped to its own case rather than the whole
        // switch, where it would sit in the temporal dead zone for the other branches.
        case 'hover': {
          // Preparation, not the user's request. It is reported as a 'preparing' step so the
          // client can show it as groundwork instead of announcing an outcome — a missed
          // pre-warm used to surface as "Could not hover over ...", which read as a failed
          // scrape even though the click that follows opens the menu itself.
          const hoverResult = await this.scraperSessionService.handleHover(
            sessionId,
            target,
            navigationSlug,
          );
          client.emit('SCRAPE_STATUS', {
            type: 'SCRAPE_STATUS',
            payload: {
              status: 'active',
              step: 'preparing',
              message: hoverResult.message,
            },
          });
          break;
        }

        case 'click': {
          if (!categorySlug) {
            throw new Error('categorySlug is required for click action');
          }
          
          client.emit('SCRAPE_STATUS', {
            type: 'SCRAPE_STATUS',
            payload: {
              status: 'scraping',
              step: 'preparing',
              message: `Scraping ${categorySlug}...`,
            },
          });

          // Each step of a click — opening the menu, a retry, falling back — is pushed as it
          // happens. The action can take tens of seconds across retries, and without this the
          // client had nothing to show between "Scraping..." and the final answer.
          const clickResult = await this.scraperSessionService.handleClick(
            sessionId,
            target,
            categorySlug,
            navigationSlug,
            (progress: ScrapeProgress) =>
              client.emit('SCRAPE_STATUS', {
                type: 'SCRAPE_STATUS',
                payload: {
                  status: 'scraping',
                  step: progress.step,
                  message: progress.message,
                  attempt: progress.attempt,
                  maxAttempts: progress.maxAttempts,
                },
              }),
          );
          
          // Send products in chunks if available
          if (clickResult.products && clickResult.products.length > 0) {
            client.emit('DATA_CHUNK', {
              type: 'DATA_CHUNK',
              payload: {
                products: clickResult.products,
                totalScraped: clickResult.totalScraped,
                hasMore: clickResult.hasMore,
                message: clickResult.message,
              },
            });
          }
          
          client.emit('SCRAPE_STATUS', {
            type: 'SCRAPE_STATUS',
            payload: {
              // Always 'ready': the action is over either way. Whether the data came from the
              // live page or from storage is carried by `source`, and `stillWorking` says the
              // queued scrape is expected to add more — a fallback is not a failure.
              status: 'ready',
              step: clickResult.source === 'stored' ? 'fallback' : 'done',
              message: clickResult.message,
              source: clickResult.source,
              stillWorking: clickResult.stillWorking ?? false,
            },
          });
          break;
        }

        case 'paginate': {
          if (!categorySlug) {
            throw new Error('categorySlug is required for paginate action');
          }
          
          client.emit('SCRAPE_STATUS', {
            type: 'SCRAPE_STATUS',
            payload: {
              status: 'scraping',
              message: `Loading more products for ${categorySlug}...`,
            },
          });
          
          const loadMoreResult = await this.scraperSessionService.handleLoadMore(
            sessionId,
            target,
            categorySlug,
            navigationSlug,
          );
          
          if (loadMoreResult.products && loadMoreResult.products.length > 0) {
            client.emit('DATA_CHUNK', {
              type: 'DATA_CHUNK',
              payload: {
                products: loadMoreResult.products,
                totalScraped: loadMoreResult.totalScraped,
                hasMore: loadMoreResult.hasMore,
                message: loadMoreResult.message,
              },
            });
          }
          
          client.emit('SCRAPE_STATUS', {
            type: 'SCRAPE_STATUS',
            payload: {
              status: loadMoreResult.status === 'success' ? 'ready' : 'idle',
              message: loadMoreResult.message,
            },
          });
          break;
        }
      }
    } catch (error) {
      this.logger.error(`Navigate error for client ${client.id}:`, error);
      client.emit('ERROR', {
        type: 'ERROR',
        payload: {
          message: `Action failed: ${error.message}`,
        },
      });
    }
  }

  @SubscribeMessage('GET_DETAILS')
  async handleGetDetails(
    @MessageBody() event: WebSocketEvent,
    @ConnectedSocket() client: Socket,
  ) {
    const sessionId = this.clientSessions.get(client.id);
    if (!sessionId) {
      client.emit('ERROR', {
        type: 'ERROR',
        payload: { message: 'No active session found' },
      });
      return;
    }

    try {
      const { target } = event.payload;
      
      client.emit('SCRAPE_STATUS', {
        type: 'SCRAPE_STATUS',
        payload: {
          status: 'scraping',
          message: `Getting product details for ${target}...`,
        },
      });
      
      const productDetails = await this.scraperSessionService.getProductDetails(
        sessionId,
        target,
      );
      
      client.emit('DATA_CHUNK', {
        type: 'DATA_CHUNK',
        payload: {
          products: [productDetails],
          totalScraped: 1,
          hasMore: false,
          message: `Loaded details for ${productDetails.title}`,
        },
      });
      
      client.emit('SCRAPE_STATUS', {
        type: 'SCRAPE_STATUS',
        payload: {
          status: 'ready',
          message: 'Product details loaded',
        },
      });
    } catch (error) {
      this.logger.error(`Get details error for client ${client.id}:`, error);
      client.emit('ERROR', {
        type: 'ERROR',
        payload: {
          message: `Failed to get product details: ${error.message}`,
        },
      });
    }
  }
}