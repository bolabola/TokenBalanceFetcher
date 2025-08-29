import type { SparkscanResponse } from "@shared/schema";

export class SparkscanAPI {
  private static readonly BASE_URL = "https://www.sparkscan.io/api/v1";
  private static readonly NETWORK = "MAINNET";

  static async getAddressInfo(address: string): Promise<SparkscanResponse> {
    const url = `${this.BASE_URL}/address/${address}?network=${this.NETWORK}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Sparkscan-Batch-Analyzer/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Sparkscan API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  static validateAddress(address: string): boolean {
    return address.startsWith('sp') && address.length > 20;
  }

  static extractAddressesFromText(text: string): string[] {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => this.validateAddress(line));
  }

  static async parseCSVFile(file: File): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const addresses = this.extractAddressesFromText(content);
          resolve(addresses);
        } catch (error) {
          reject(new Error('Failed to parse CSV file'));
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
}
