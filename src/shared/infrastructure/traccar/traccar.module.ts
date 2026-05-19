import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TraccarProvider } from './traccar.provider';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'ITraccarProvider',
      useClass: TraccarProvider,
    },
  ],
  exports: ['ITraccarProvider'],
})
export class TraccarModule {}
