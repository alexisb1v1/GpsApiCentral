import { IQuery } from '@nestjs/cqrs';

export class GetDriverByIdQuery implements IQuery {
  constructor(
    public readonly id: string,
  ) {}
}
