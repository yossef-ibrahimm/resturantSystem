import { Controller, Post, UploadedFile, UseInterceptors, UseGuards, BadRequestException } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { StorageService } from "./storage.service";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";

@Controller("upload")
@UseGuards(RolesGuard)
@Roles("admin")
export class StorageController {
  constructor(private storageService: StorageService) {}

  @Post("image")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
          // BE-022: must return after reject — never call cb twice.
          cb(new BadRequestException("Only image files are allowed"), false);
          return;
        }
        cb(null, true);
      },
    })
  )
  async uploadImage(@UploadedFile() file: { buffer: Buffer; size: number; mimetype: string; originalname: string }) {
    if (!file) throw new BadRequestException("No file uploaded");
    const url = await this.storageService.uploadImage(file);
    return { url };
  }
}
