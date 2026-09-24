import { Module } from "@nestjs/common";
import { ExpenseCategoriesService } from "./expense-categories.service";
import { ExpensesService } from "./expenses.service";
import { ExpenseCategoriesController } from "./expense-categories.controller";
import { ExpensesController } from "./expenses.controller";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  providers: [ExpenseCategoriesService, ExpensesService],
  controllers: [ExpenseCategoriesController, ExpensesController],
  exports: [ExpenseCategoriesService, ExpensesService],
})
export class ExpenseModule {}
