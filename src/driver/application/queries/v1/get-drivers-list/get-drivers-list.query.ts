import { IQuery } from '@nestjs/cqrs';

export class GetDriversListQuery implements IQuery {
  constructor(
    public readonly tenantId?: string,
  ) {}
}
