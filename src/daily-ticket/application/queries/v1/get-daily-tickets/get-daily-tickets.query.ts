export class GetDailyTicketsQuery {
  constructor(
    public readonly tenantId: string,
    public readonly workDate?: string,
  ) {}
}
