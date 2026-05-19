import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: any) {
    // Aquí podrías validar si el usuario aún existe en la BD o si el Tenant sigue activo
    return { 
      userId: payload.sub, 
      sub: payload.sub,
      email: payload.email, 
      tenantId: payload.tenantId, 
      role: payload.role 
    };
  }
}
