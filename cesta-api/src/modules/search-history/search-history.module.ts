import { Module } from '@nestjs/common';
import { SearchHistoryController } from './search-history.controller';
import { SearchHistoryRepository } from './search-history.repository';
import { SearchHistoryService } from './search-history.service';

@Module({
  controllers: [SearchHistoryController],
  providers: [SearchHistoryService, SearchHistoryRepository],
  exports: [SearchHistoryService],
})
export class SearchHistoryModule {}
