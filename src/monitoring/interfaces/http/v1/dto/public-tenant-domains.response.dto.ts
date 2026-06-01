export class PublicTenantDomainsResponseDto {
  success: boolean;
  subdomain: string;
  allowedDomains: string | null;

  constructor(subdomain: string, allowedDomains: string | null) {
    this.success = true;
    this.subdomain = subdomain;
    this.allowedDomains = allowedDomains;
  }
}
