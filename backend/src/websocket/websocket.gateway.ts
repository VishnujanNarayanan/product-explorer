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
import { ScraperSessionService } from '../modules/scraper/scraper-session.service';

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

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    
    try {
      // Create a new scraper session for this client
      await this.scraperSessionService.createSession(client.id);
      this.clientSessions.set(client.id, client.id);
      
      // Send session ready event
      client.emit('SESSION_READY', {
        type: 'SESSION_READY',
        payload: {
          sessionId: client.id,
          status: 'ready',
          message: 'Interactive scraper session initialized',
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create session for ${client.id}:`, error);
      client.emit('ERROR', {
        type: 'ERROR',
        payload: {
          message: `Failed to initialize scraper session: ${error.message}`,
        },
      });
    }
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
        case 'hover':
          const hoverResult = await this.scraperSessionService.handleHover(
            sessionId,
            target,
            navigationSlug,
          );
          client.emit('SCRAPE_STATUS', {
            type: 'SCRAPE_STATUS',
            payload: {
              status: hoverResult.status === 'success' ? 'active' : 'idle',
              message: hoverResult.message,
            },
          });
          break;

        case 'click':
          if (!categorySlug) {
            throw new Error('categorySlug is required for click action');
          }
          
          client.emit('SCRAPE_STATUS', {
            type: 'SCRAPE_STATUS',
            payload: {
              status: 'scraping',
              message: `Scraping ${categorySlug}...`,
            },
          });
          
          const clickResult = await this.scraperSessionService.handleClick(
            sessionId,
            target,
            categorySlug,
            navigationSlug,
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
              status: clickResult.status === 'success' ? 'ready' : 'idle',
              message: clickResult.message,
            },
          });
          break;

        case 'paginate':
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