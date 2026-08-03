import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as Minio from "minio";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

type Driver = "minio" | "local";

@Injectable()
export class StorageService implements OnModuleInit {
  private minioClient?: Minio.Client;
  private bucket: string;
  private driver: Driver;
  private localDir: string;
  private logger = new Logger(StorageService.name);

  constructor(private config: ConfigService) {
    this.bucket = config.get("MINIO_BUCKET", "tastytable-images");
    this.localDir = path.resolve(config.get("LOCAL_UPLOAD_DIR", "uploads"));
    this.driver = (config.get("STORAGE_DRIVER", "auto") as "auto" | "minio" | "local") === "local"
      ? "local"
      : "minio";
  }

  async onModuleInit() {
    if (this.driver === "minio") {
      await this.initMinio();
    }
    fs.mkdirSync(this.localDir, { recursive: true });
  }

  private async initMinio() {
    try {
      this.minioClient = new Minio.Client({
        endPoint: this.config.get("MINIO_ENDPOINT", "localhost"),
        port: parseInt(this.config.get("MINIO_PORT", "9000")),
        useSSL: this.config.get("MINIO_USE_SSL", "false") === "true",
        accessKey: this.config.get("MINIO_ACCESS_KEY", "minioadmin"),
        secretKey: this.config.get("MINIO_SECRET_KEY", "minioadmin"),
      });
      const exists = await this.minioClient.bucketExists(this.bucket);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucket);
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
      this.logger.log(`MinIO ready at ${this.config.get("MINIO_ENDPOINT", "localhost")}:${this.config.get("MINIO_PORT", "9000")}`);
    } catch (error) {
      this.minioClient = undefined;
      if (this.config.get("STORAGE_DRIVER") === "minio") {
        this.logger.error(`MinIO unavailable and STORAGE_DRIVER=minio: uploads will fail: ${error.message}`);
      } else {
        this.logger.warn(`MinIO not available, falling back to local disk storage: ${error.message}`);
      }
    }
  }

  async uploadImage(file: { buffer: Buffer; size: number; mimetype: string; originalname: string }): Promise<string> {
    const ext = path.extname(file.originalname) || ".img";
    const key = `menu-items/${crypto.randomUUID()}${ext}`;

    if (this.minioClient) {
      await this.minioClient.putObject(this.bucket, key, file.buffer, file.size, {
        "Content-Type": file.mimetype,
      });
      const endpoint = this.config.get("MINIO_ENDPOINT", "localhost");
      const port = this.config.get("MINIO_PORT", "9000");
      const useSsl = this.config.get("MINIO_USE_SSL", "false") === "true";
      const protocol = useSsl ? "https" : "http";
      return `${protocol}://${endpoint}:${port}/${this.bucket}/${key}`;
    }

    const abs = path.join(this.localDir, key);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, file.buffer);
    return `/api/uploads/${key}`;
  }
}
