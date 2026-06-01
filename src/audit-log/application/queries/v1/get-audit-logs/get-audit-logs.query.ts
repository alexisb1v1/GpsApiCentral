export class GetAuditLogsQuery {
  constructor(
    public readonly tenantId: string | null,
    public readonly startDate?: string,
    public readonly endDate?: string,
    public readonly action?: string,
    public readonly entityName?: string,
    public readonly page?: number,
    public readonly limit?: number,
  ) {}
}
