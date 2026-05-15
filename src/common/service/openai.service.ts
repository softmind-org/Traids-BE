import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class OpenAiService {
  private readonly client: Anthropic;
  private readonly logger = new Logger(OpenAiService.name);

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });
  }

  /**
   * Uses Claude vision to verify the uploaded file is actually the expected
   * document type (insurance, tickets, or certification).
   * Throws if the image is unrelated (e.g. a personal photo, meme, etc.).
   */
  async validateDocumentType(
    imageBase64: string,
    mimeType: string,
    documentType: 'insurance' | 'tickets' | 'certification',
  ): Promise<void> {
    const descriptions: Record<string, string> = {
      insurance: 'an insurance policy, certificate of insurance, or liability insurance document',
      tickets: 'a trade licence, qualification ticket, certification card, or skills ticket for a tradesperson',
      certification: 'a professional certification, accreditation certificate, or trade qualification document',
    };

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: `Does this image show ${descriptions[documentType]}? Answer with YES or NO only. Do not explain.`,
            },
          ],
        },
      ],
    });

    const answer = (response.content[0] as any)?.text?.trim().toUpperCase();
    this.logger.log(`Document type validation (${documentType}): ${answer}`);

    if (!answer || !answer.startsWith('YES')) {
      throw new Error(
        `The uploaded file does not appear to be a valid ${documentType} document. Please upload the correct document type.`,
      );
    }
  }

  /**
   * Sends a document image (as base64) to Claude vision
   * and extracts the expiry date. Returns an ISO date string or null.
   */
  async extractExpiryDate(
    imageBase64: string,
    mimeType: string,
  ): Promise<string | null> {
    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 12000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                  data: imageBase64,
                },
              },
              {
                type: 'text',
                text: `Look at this document and extract the expiry date, expiration date, valid until date, or renewal date.
Return ONLY the date in ISO 8601 format (YYYY-MM-DD).
If no expiry date is found, return the word null.
Do not include any explanation, just the date or null.`,
              },
            ],
          },
        ],
      });

      const raw = (response.content[0] as any)?.text?.trim();
      this.logger.log(`Claude expiry extraction result: ${raw}`);

      if (!raw || raw.toLowerCase() === 'null') return null;

      const parsed = new Date(raw);
      if (isNaN(parsed.getTime())) return null;

      return parsed.toISOString();
    } catch (err) {
      this.logger.error(`Claude extraction failed: ${err.message}`);
      return null;
    }
  }
}
