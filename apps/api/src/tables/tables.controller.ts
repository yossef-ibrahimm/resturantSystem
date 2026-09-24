import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import { TablesService } from "./tables.service";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import {
  IsNumber,
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  Min,
  Max,
} from "class-validator";

class CreateTableDto {
  @IsNumber()
  @Min(1)
  @Max(500)
  number: number;

  @IsString()
  @IsOptional()
  label?: string;

  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  capacity?: number;
}

class UpdateTableDto {
  @IsString()
  @IsOptional()
  label?: string;

  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  capacity?: number;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}

class MergeOrdersDto {
  @IsArray()
  @IsString({ each: true })
  orderIds: string[];

  @IsString()
  @IsOptional()
  label?: string;
}

@Controller("tables")
@UseGuards(RolesGuard)
export class TablesController {
  constructor(private tablesService: TablesService) {}

  @Get()
  findAll() {
    return this.tablesService.findAll();
  }

  @Get("occupancy")
  @Roles("admin", "waiter")
  getOccupancyReport() {
    return this.tablesService.getOccupancyReport();
  }

  @Get("stale")
  @Roles("admin", "waiter")
  getStaleTables() {
    return this.tablesService.getStaleTables();
  }

  @Get("merged")
  @Roles("admin", "cashier")
  getMergedGroups() {
    return this.tablesService.getMergedGroups();
  }

  @Get(":id")
  findById(@Param("id") id: string) {
    return this.tablesService.findById(id);
  }

  @Post()
  @Roles("admin")
  create(@Body() dto: CreateTableDto) {
    return this.tablesService.create(dto);
  }

  @Patch(":id")
  @Roles("admin")
  update(@Param("id") id: string, @Body() dto: UpdateTableDto) {
    return this.tablesService.update(id, dto);
  }

  @Delete(":id")
  @Roles("admin")
  delete(@Param("id") id: string) {
    return this.tablesService.delete(id);
  }

  @Post("seed")
  @Roles("admin")
  seedFromSettings() {
    return this.tablesService.seedFromSettings();
  }

  @Post("merge")
  @Roles("admin", "cashier")
  mergeOrders(@Body() dto: MergeOrdersDto) {
    return this.tablesService.mergeOrders(dto);
  }

  @Delete("merged/:id")
  @Roles("admin", "cashier")
  unmergeOrders(@Param("id") id: string) {
    return this.tablesService.unmergeOrders(id);
  }
}
