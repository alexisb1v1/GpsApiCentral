export class GetInfractionsQuery {
  constructor(
    public readonly tenantId?: string,
    public readonly driverId?: string,
    public readonly date?: string,
  ) {}
}
