import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  type?: 'access' | 'refresh';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('app.jwt.secret'),
    });
  }

  async validate(
    payload: JwtPayload,
  ): Promise<{ id: string; email: string; role: string }> {
    // A refresh token is signed with the same secret, so without this check it
    // authenticates every endpoint — which made it an access token with a
    // seven-day life rather than a refresh token.
    if (payload.type === 'refresh') {
      throw new UnauthorizedException(
        'Refresh token cannot be used to authenticate',
      );
    }

    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
