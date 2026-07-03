import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || user.userType !== 'admin') {
      throw new ForbiddenException('Access restricted to platform administrators');
    }

    if (user.isActive === false) {
      throw new ForbiddenException('This admin account has been deactivated');
    }

    return true;
  }
}
