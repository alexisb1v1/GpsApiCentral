export class GetVehicleRouteQuery {
  constructor(
    public readonly traccarDeviceId: number,
    public readonly from: Date,
    public readonly to: Date,
  ) { }
}
