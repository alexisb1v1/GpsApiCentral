/* src/dashboard/application/queries/v1/verify-ticket.query.ts */
export class VerifyTicketQuery {
  constructor(
    public readonly code: string,
    public readonly subdomain?: string,
  ) {}
}
