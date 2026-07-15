import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as Minio from "minio";
import * as crypto from "crypto";

@Injectable()
export class StorageService {
  private minioClient: Minio.Client;
  private bucket: string;
  private logger = new Logger(StorageService.name);

  constructor(private config: ConfigService) {
    this.bucket = config.get("MINIO_BUCKET", "tastytable-images");
    this.minioClient = new Minio.Client({
      endPoint: config.get("MINIO_ENDPOINT", "localhost"),
      port: parseInt(config.get("MINIO_PORT", "9000")),
      useSSL: config.get("MINIO_USE_SSL", "false") === "true",
      accessKey: config.get("MINIO_ACCESS_KEY", "minioadmin"),
      secretKey: config.get("MINIO_SECRET_KEY", "minioadmin"),
    });
    this.ensureBucket();
  }

  private async ensureBucket() {
    try {
      const exists = await this.minioClient.bucketExists(this.bucket);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucket);
        // Set public read policy
        const policy = {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: { AWS: ["*"] },
              Action: ["s3:GetObject"],
              Resource: [`arn:aws:s3:::${this.bucket}/*`],
            },
          ],
        };
        await this.minioClient.setBucketPolicy(this.bucket, JSON.stringify(policy));
        this.logger.log(`Bucket "${this.bucket}" created with public read`);
      }
    } catch (error) {
      this.logger.warn(`MinIO not available, image upload will fail: ${error.message}`);
    }
  }

  async uploadImage(file: { buffer: Buffer; size: number; mimetype: string; originalname: string }): Promise<string> {
    const ext = file.originalname.split(".").pop();
    const key = `menu-items/${crypto.randomUUID()}.${ext}`;

    await this.minioClient.putObject(this.bucket, key, file.buffer, file.size, {
      "Content-Type": file.mimetype,
    });

    const endpoint = this.config.get("MINIO_ENDPOINT", "localhost");
    const port = this.config.get("MINIO_PORT", "9000");
    const useSsl = this.config.get("MINIO_USE_SSL", "false") === "true";
    const protocol = useSsl ? "https" : "http";

    return `${protocol}://${endpoint}:${port}/${this.bucket}/${key}`;
  }
}
