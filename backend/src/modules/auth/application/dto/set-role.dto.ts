import { IsIn } from 'class-validator';
import { ALL_ROLES, UserRole } from '../../domain/constants/role.constants';

/**
 * The runtime guard the removed `RegisterDto.role` never had.
 *
 * That field was typed `'admin' | 'user'` with no validator at all, so
 * TypeScript rejected a bad value at compile time and nothing rejected it at
 * runtime — which is not a check, since the value arrives as JSON from a
 * client. Here the allowed set comes from the domain constants, so adding a
 * role cannot leave this behind.
 */
export class SetRoleDto {
  @IsIn(ALL_ROLES as unknown as string[], {
    message: `role must be one of: ${ALL_ROLES.join(', ')}`,
  })
  role: UserRole;
}
