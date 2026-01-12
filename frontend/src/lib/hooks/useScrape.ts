import { useState } from 'react';
import { useToast } from './useToast';
import { navigationAPI } from '../api/navigation';
import { productsAPI } from '../api/products';

export const useScrape = () => {
  const { toast } = useToast();
  const [isScraping, setIsScraping] = useState(false);

  const scrapeNavigation = async () => {
    setIsScraping(true);
    try {
      const result = await navigationAPI.scrapeNavigation();
      toast({
        title: "Navigation Scraped",
        description: result.message || "Navigation data updated successfully"
      });
      return result;
    } catch (error: any) {
      toast({
        title: "Scraping Failed",
        description: error.message || "Failed to scrape navigation",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsScraping(false);
    }
  };

  const scrapeCategory = async (slug: string) => {
    setIsScraping(true);
    try {
      const result = await navigationAPI.scrapeCategory(slug);
      toast({
        title: "Category Scraping Started",
        description: "Products are being scraped in the background"
      });
      return result;
    } catch (error: any) {
      toast({
        title: "Scraping Failed",
        description: error.message || "Failed to scrape category",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsScraping(false);
    }
  };

  const scrapeProduct = async (sourceId: string, forceRefresh = false) => {
    setIsScraping(true);
    try {
      const result = await productsAPI.scrapeProduct(sourceId, forceRefresh);
      toast({
        title: "Product Scraping Started",
        description: result.message || "Product details are being updated"
      });
      return result;
    } catch (error: any) {
      toast({
        title: "Scraping Failed",
        description: error.message || "Failed to scrape product",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsScraping(false);
    }
  };

  return {
    isScraping,
    scrapeNavigation,
    scrapeCategory,
    scrapeProduct,
  };
};