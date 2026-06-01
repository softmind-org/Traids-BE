import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user;
    if (!user) throw new ForbiddenException('User not authenticated');
    if (user.userType !== 'admin') throw new ForbiddenException('Access restricted to platform admins');
    if (user.isActive === false) throw new ForbiddenException('Admin account is deactivated');
    return true;
  }
}
