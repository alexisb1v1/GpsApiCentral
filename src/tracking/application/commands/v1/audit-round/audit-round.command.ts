export class AuditRoundCommand {
  constructor(
    public readonly roundId: string,
    public readonly isIncomplete: boolean,
  ) {}
}
