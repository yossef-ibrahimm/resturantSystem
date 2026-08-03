import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import * as dotenv from "dotenv";
import * as express from "express";
import * as path from "path";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

dotenv.config();

if (process.env.NODE_ENV === "production") {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === "change-this-to-a-strong-random-secret") {
    throw new Error(
      "JWT_SECRET must be set to a strong random value in production. Refusing to start."
    );
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");

  app.use(helmet());

  app.getHttpAdapter().getInstance().set("trust proxy", 1);

  app.use(
    "/api/uploads",
    express.static(path.resolve(process.env.LOCAL_UPLOAD_DIR || "uploads"))
  );

  const frontendUrls = (process.env.FRONTEND_URL || "http://localhost:8080").split(",").map(s => s.trim());
  app.enableCors({
    origin: frontendUrls,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}
bootstrap();
