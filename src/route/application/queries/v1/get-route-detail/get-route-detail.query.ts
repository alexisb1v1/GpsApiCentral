export class GetRouteDetailQuery {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
  ) {}
}
