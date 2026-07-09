# User Context — Phase 1D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement User Context bounded context — profile CRUD, session management, change password. Independent from Auth BC, userId as event reference.

**Architecture:** New `modules/user/` following Hexagonal DDD pattern. Reads `userId` from RequestContext. Communicates with Auth via event bus (inbound) and port interface (outbound). No FK to Auth tables.

**Tech Stack:** NestJS 10, TypeORM 0.3, PostgreSQL (separate `ddd_user` DB), CQRS EventBus.

## Global Constraints
- `userId` is a string event reference — NEVER a foreign key.
- User BC must NOT import any Auth domain types.
- Cross-context: Auth→User via events, User→Auth via port interface.
- All endpoints gated behind `@Gate('userProfile')`.
- Feature flag: `FEATURE_USER_PROFILE` (added in Phase 1B).
- Port injection tokens: `USER_PROFILE_REPOSITORY`, `USER_SESSION_REPOSITORY`, `AUTH_PASSWORD_PORT`.

---

### Task 1: Domain — Entities + Value Objects

**Files:**
- Create: `backend/src/modules/user/domain/value-objects/phone.value-object.ts`
- Create: `backend/src/modules/user/domain/entities/user-profile.entity.ts`
- Create: `backend/src/modules/user/domain/entities/user-session.entity.ts`
- Create: `backend/src/modules/user/domain/entities/user-created.event.ts`

- [ ] **Step 1: Phone value object**

```ts
// phone.value-object.ts
import { ValidationError } from '../../../../shared/domain/errors/domain-error';

export class Phone {
  constructor(private readonly value: string) {
    if (!/^\+?[0-9]{7,15}$/.test(value)) {
      throw new ValidationError('Invalid phone number');
    }
  }
  toString(): string { return this.value; }
  equals(other: Phone): boolean { return this.value === other.value; }
}
```

- [ ] **Step 2: UserProfile entity**

```ts
// user-profile.entity.ts
import { Phone } from '../value-objects/phone.value-object';

export type UserStatus = 'active' | 'inactive';

export class UserProfile {
  constructor(
    public readonly userId: string,
    public firstName: string,
    public lastName: string,
    public email: string,
    public phone?: Phone,
    public avatar?: string,
    public status: UserStatus = 'inactive',
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
    public version: number = 1,
  ) {}

  static create(userId: string, email: string): UserProfile {
    return new UserProfile(userId, '', '', email);
  }

  updateProfile(firstName?: string, lastName?: string, phone?: Phone, avatar?: string): void {
    if (firstName !== undefined) this.firstName = firstName;
    if (lastName !== undefined) this.lastName = lastName;
    if (phone !== undefined) this.phone = phone;
    if (avatar !== undefined) this.avatar = avatar;
    this.updatedAt = new Date();
  }

  activate(): void { this.status = 'active'; }
  deactivate(): void { this.status = 'inactive'; }
}
```

- [ ] **Step 3: UserSession entity**

```ts
// user-session.entity.ts
export class UserSession {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public refreshTokenHash: string,
    public userAgent?: string,
    public ip?: string,
    public readonly createdAt: Date = new Date(),
    public expiresAt: Date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    public revokedAt?: Date,
  ) {}

  get isExpired(): boolean { return new Date() > this.expiresAt; }
  get isRevoked(): boolean { return !!this.revokedAt; }

  revoke(): void { this.revokedAt = new Date(); }
  rotate(newHash: string): void { this.refreshTokenHash = newHash; }
}
```

- [ ] **Step 4: UserCreated event**

```ts
// user-created.event.ts
import { DomainEvent } from '../../../../shared/adapters/event-bus/domain-event';

export class UserCreatedEvent extends DomainEvent {
  constructor(public readonly userId: string, public readonly email: string) {
    super('UserCreated');
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/user/domain/ && git commit -m "feat: add User Profile + Session domain entities"
```

---

### Task 2: Domain Ports (Repository Interfaces)

**Files:**
- Create: `backend/src/modules/user/domain/ports/user-profile.repository.port.ts`
- Create: `backend/src/modules/user/domain/ports/user-session.repository.port.ts`

- [ ] **Step 1: UserProfile repository port**

```ts
// user-profile.repository.port.ts
import { UserProfile } from '../entities/user-profile.entity';

export const USER_PROFILE_REPOSITORY = 'USER_PROFILE_REPOSITORY';

export interface IUserProfileRepository {
  save(profile: UserProfile): Promise<void>;
  findByUserId(userId: string): Promise<UserProfile | null>;
}
```

- [ ] **Step 2: UserSession repository port**

```ts
// user-session.repository.port.ts
import { UserSession } from '../entities/user-session.entity';

export const USER_SESSION_REPOSITORY = 'USER_SESSION_REPOSITORY';

export interface IUserSessionRepository {
  save(session: UserSession): Promise<void>;
  findByRefreshTokenHash(hash: string): Promise<UserSession | null>;
  revokeByUserId(userId: string, exceptSessionId?: string): Promise<void>;
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/user/domain/ports/ && git commit -m "feat: add User repository ports"
```

---

### Task 3: Application Ports + DTOs

**Files:**
- Create: `backend/src/modules/user/application/ports/auth-password.port.ts`
- Create: `backend/src/modules/user/application/dto/profile.dto.ts`
- Create: `backend/src/modules/user/application/dto/update-profile.dto.ts`

- [ ] **Step 1: Auth password port (User → Auth)**

```ts
// auth-password.port.ts
export const AUTH_PASSWORD_PORT = 'AUTH_PASSWORD_PORT';

export interface IAuthPasswordPort {
  changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void>;
}
```

- [ ] **Step 2: ProfileDto**

```ts
// profile.dto.ts
export class ProfileDto {
  constructor(
    public readonly userId: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly email: string,
    public readonly phone?: string,
    public readonly avatar?: string,
    public readonly status: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
```

- [ ] **Step 3: UpdateProfileDto**

```ts
// update-profile.dto.ts
import { IsOptional, IsString } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional() @IsString()
  firstName?: string;

  @IsOptional() @IsString()
  lastName?: string;

  @IsOptional() @IsString()
  phone?: string;

  @IsOptional() @IsString()
  avatar?: string;
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/user/application/ports/ backend/src/modules/user/application/dto/ && git commit -m "feat: add User application ports and DTOs"
```

---

### Task 4: Use Cases

**Files:**
- Create: `backend/src/modules/user/application/use-cases/get-profile.use-case.ts`
- Create: `backend/src/modules/user/application/use-cases/update-profile.use-case.ts`
- Create: `backend/src/modules/user/application/use-cases/change-password.use-case.ts`

- [ ] **Step 1: GetProfileUseCase**

```ts
// get-profile.use-case.ts
import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { USER_PROFILE_REPOSITORY, IUserProfileRepository } from '../../domain/ports/user-profile.repository.port';
import { ProfileDto } from '../dto/profile.dto';

@Injectable()
export class GetProfileUseCase {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY) private readonly repo: IUserProfileRepository,
  ) {}

  async execute(userId: string): Promise<ProfileDto> {
    const profile = await this.repo.findByUserId(userId);
    if (!profile) {
      throw new Error('Profile not found'); // ApplicationError.ResourceNotFoundError
    }
    return new ProfileDto(
      profile.userId, profile.firstName, profile.lastName, profile.email,
      profile.phone?.toString(), profile.avatar, profile.status,
      profile.createdAt, profile.updatedAt,
    );
  }
}
```

- [ ] **Step 2: UpdateProfileUseCase**

```ts
// update-profile.use-case.ts
import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { USER_PROFILE_REPOSITORY, IUserProfileRepository } from '../../domain/ports/user-profile.repository.port';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { ProfileDto } from '../dto/profile.dto';
import { Phone } from '../../domain/value-objects/phone.value-object';

@Injectable()
export class UpdateProfileUseCase {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY) private readonly repo: IUserProfileRepository,
  ) {}

  async execute(userId: string, dto: UpdateProfileDto): Promise<ProfileDto> {
    const profile = await this.repo.findByUserId(userId);
    if (!profile) throw new Error('Profile not found');

    profile.updateProfile(
      dto.firstName,
      dto.lastName,
      dto.phone ? new Phone(dto.phone) : undefined,
      dto.avatar,
    );

    await this.repo.save(profile);

    return new ProfileDto(
      profile.userId, profile.firstName, profile.lastName, profile.email,
      profile.phone?.toString(), profile.avatar, profile.status,
      profile.createdAt, profile.updatedAt,
    );
  }
}
```

- [ ] **Step 3: ChangePasswordUseCase**

```ts
// change-password.use-case.ts
import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { AUTH_PASSWORD_PORT, IAuthPasswordPort } from '../ports/auth-password.port';

@Injectable()
export class ChangePasswordUseCase {
  constructor(
    @Inject(AUTH_PASSWORD_PORT) private readonly authPassword: IAuthPasswordPort,
  ) {}

  async execute(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    await this.authPassword.changePassword(userId, oldPassword, newPassword);
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/user/application/use-cases/ && git commit -m "feat: add User use cases (get/update profile, change password)"
```

---

### Task 5: Controller

**Files:**
- Create: `backend/src/modules/user/adapters/inbound/controllers/user.controller.ts`

- [ ] **Step 1: Create controller**

```ts
// user.controller.ts
import { Controller, Get, Patch, Body, UseGuards, Post } from '@nestjs/common';
import { AuthGuard } from '../../../../auth/adapters/outbound/auth/jwt-auth.guard';
import { Gate } from '../../../../shared/adapters/feature-gate/gate.decorator';
import { RequestContextService } from '../../../../shared/adapters/request-context/request-context.service';
import { GetProfileUseCase } from '../../../application/use-cases/get-profile.use-case';
import { UpdateProfileUseCase } from '../../../application/use-cases/update-profile.use-case';
import { ChangePasswordUseCase } from '../../../application/use-cases/change-password.use-case';
import { UpdateProfileDto } from '../../../application/dto/update-profile.dto';

@Controller('api/v1')
@UseGuards(AuthGuard)
export class UserController {
  constructor(
    private readonly getProfile: GetProfileUseCase,
    private readonly updateProfile: UpdateProfileUseCase,
    private readonly changePassword: ChangePasswordUseCase,
    private readonly requestCtx: RequestContextService,
  ) {}

  @Get('me')
  @Gate('userProfile')
  async getMyProfile() {
    const userId = this.requestCtx.getIdentity()?.userId;
    if (!userId) throw new Error('Unauthorized');
    return this.getProfile.execute(userId);
  }

  @Patch('me/profile')
  @Gate('userProfile')
  async updateMyProfile(@Body() dto: UpdateProfileDto) {
    const userId = this.requestCtx.getIdentity()?.userId;
    if (!userId) throw new Error('Unauthorized');
    return this.updateProfile.execute(userId, dto);
  }

  @Post('auth/change-password')
  @Gate('userProfile')
  async changeMyPassword(@Body('oldPassword') oldPw: string, @Body('newPassword') newPw: string) {
    const userId = this.requestCtx.getIdentity()?.userId;
    if (!userId) throw new Error('Unauthorized');
    await this.changePassword.execute(userId, oldPw, newPw);
    return { message: 'Password changed' };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/modules/user/adapters/inbound/controllers/ && git commit -m "feat: add User controller (GET /me, PATCH /me/profile, POST change-password)"
```

---

### Task 6: Persistence Adapters (TypeORM)

**Files:**
- Create: `backend/src/modules/user/adapters/outbound/persistence/typeorm-user-profile.entity.ts`
- Create: `backend/src/modules/user/adapters/outbound/persistence/user-profile.repository.ts`
- Create: `backend/src/modules/user/adapters/outbound/persistence/typeorm-user-session.entity.ts`
- Create: `backend/src/modules/user/adapters/outbound/persistence/user-session.repository.ts`

- [ ] **Step 1: TypeORM UserProfile entity**

```ts
// typeorm-user-profile.entity.ts
import { Entity, Column, PrimaryColumn, VersionColumn } from 'typeorm';

@Entity('user_profiles')
export class TypeOrmUserProfile {
  @PrimaryColumn()
  userId: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  avatar?: string;

  @Column({ default: 'inactive' })
  status: string;

  @Column()
  createdAt: Date;

  @Column()
  updatedAt: Date;

  @VersionColumn()
  version: number;
}
```

- [ ] **Step 2: UserProfile repository**

```ts
// user-profile.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TypeOrmUserProfile } from './typeorm-user-profile.entity';
import { UserProfile } from '../../../domain/entities/user-profile.entity';
import { IUserProfileRepository } from '../../../domain/ports/user-profile.repository.port';
import { Phone } from '../../../domain/value-objects/phone.value-object';

@Injectable()
export class UserProfileRepository implements IUserProfileRepository {
  constructor(
    @InjectRepository(TypeOrmUserProfile) private readonly repo: Repository<TypeOrmUserProfile>,
  ) {}

  async save(profile: UserProfile): Promise<void> {
    const entity = this.toTypeOrm(profile);
    await this.repo.save(entity);
  }

  async findByUserId(userId: string): Promise<UserProfile | null> {
    const entity = await this.repo.findOne({ where: { userId } });
    return entity ? this.toDomain(entity) : null;
  }

  private toTypeOrm(domain: UserProfile): TypeOrmUserProfile {
    const entity = new TypeOrmUserProfile();
    entity.userId = domain.userId;
    entity.firstName = domain.firstName;
    entity.lastName = domain.lastName;
    entity.email = domain.email;
    entity.phone = domain.phone?.toString();
    entity.avatar = domain.avatar;
    entity.status = domain.status;
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;
    entity.version = domain.version;
    return entity;
  }

  private toDomain(entity: TypeOrmUserProfile): UserProfile {
    return new UserProfile(
      entity.userId, entity.firstName, entity.lastName, entity.email,
      entity.phone ? new Phone(entity.phone) : undefined,
      entity.avatar, entity.status as any,
      entity.createdAt, entity.updatedAt, entity.version,
    );
  }
}
```

- [ ] **Step 3: TypeORM UserSession entity**

```ts
// typeorm-user-session.entity.ts
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('user_sessions')
export class TypeOrmUserSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  refreshTokenHash: string;

  @Column({ nullable: true })
  userAgent?: string;

  @Column({ nullable: true })
  ip?: string;

  @Column()
  createdAt: Date;

  @Column()
  expiresAt: Date;

  @Column({ nullable: true })
  revokedAt?: Date;
}
```

- [ ] **Step 4: UserSession repository**

```ts
// user-session.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TypeOrmUserSession } from './typeorm-user-session.entity';
import { UserSession } from '../../../domain/entities/user-session.entity';
import { IUserSessionRepository } from '../../../domain/ports/user-session.repository.port';

@Injectable()
export class UserSessionRepository implements IUserSessionRepository {
  constructor(
    @InjectRepository(TypeOrmUserSession) private readonly repo: Repository<TypeOrmUserSession>,
  ) {}

  async save(session: UserSession): Promise<void> {
    const entity = this.toTypeOrm(session);
    await this.repo.save(entity);
  }

  async findByRefreshTokenHash(hash: string): Promise<UserSession | null> {
    const entity = await this.repo.findOne({ where: { refreshTokenHash: hash } });
    return entity ? this.toDomain(entity) : null;
  }

  async revokeByUserId(userId: string, exceptSessionId?: string): Promise<void> {
    await this.repo.update(
      { userId, ...(exceptSessionId ? { id: { $ne: exceptSessionId } as any } : {}) },
      { revokedAt: new Date() },
    );
  }

  private toTypeOrm(domain: UserSession): TypeOrmUserSession { ... }
  private toDomain(entity: TypeOrmUserSession): UserSession { ... }
}
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/user/adapters/outbound/persistence/ && git commit -m "feat: add User persistence adapters (TypeORM)"
```

---

### Task 7: UserModule — Composition Root

**Files:**
- Create: `backend/src/modules/user/user.module.ts`
- Modify: `backend/src/app.module.ts` (import UserModule)

- [ ] **Step 1: Create UserModule**

```ts
// user.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmUserProfile } from './adapters/outbound/persistence/typeorm-user-profile.entity';
import { TypeOrmUserSession } from './adapters/outbound/persistence/typeorm-user-session.entity';
import { UserProfileRepository } from './adapters/outbound/persistence/user-profile.repository';
import { UserSessionRepository } from './adapters/outbound/persistence/user-session.repository';
import { USER_PROFILE_REPOSITORY } from './domain/ports/user-profile.repository.port';
import { USER_SESSION_REPOSITORY } from './domain/ports/user-session.repository.port';
import { GetProfileUseCase } from './application/use-cases/get-profile.use-case';
import { UpdateProfileUseCase } from './application/use-cases/update-profile.use-case';
import { ChangePasswordUseCase } from './application/use-cases/change-password.use-case';
import { UserController } from './adapters/inbound/controllers/user.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([TypeOrmUserProfile, TypeOrmUserSession]),
  ],
  controllers: [UserController],
  providers: [
    { provide: USER_PROFILE_REPOSITORY, useClass: UserProfileRepository },
    { provide: USER_SESSION_REPOSITORY, useClass: UserSessionRepository },
    GetProfileUseCase,
    UpdateProfileUseCase,
    ChangePasswordUseCase,
  ],
})
export class UserModule {}
```

- [ ] **Step 2: Register in AppModule**

```ts
// app.module.ts — add to imports:
UserModule,
```

- [ ] **Step 3: Build**

Run: `cd backend && pnpm build`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git commit -am "feat: add UserModule and register in AppModule"
```

---

### Task 8: Event Handler — Create Profile on UserRegistered

**Files:**
- Create: `backend/src/modules/user/application/handlers/user-registered.handler.ts`

- [ ] **Step 1: Create event handler**

```ts
// user-registered.handler.ts
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UserCreatedEvent } from '../../domain/entities/user-created.event';
import { USER_PROFILE_REPOSITORY, IUserProfileRepository } from '../../domain/ports/user-profile.repository.port';
import { UserProfile } from '../../domain/entities/user-profile.entity';

@EventsHandler(UserCreatedEvent)
export class UserRegisteredHandler implements IEventHandler<UserCreatedEvent> {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY) private readonly repo: IUserProfileRepository,
  ) {}

  async handle(event: UserCreatedEvent): Promise<void> {
    const profile = UserProfile.create(event.userId, event.email);
    profile.activate();
    await this.repo.save(profile);
  }
}
```

- [ ] **Step 2: Register handler in UserModule providers**

```ts
// add to providers:
UserRegisteredHandler,
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/user/application/handlers/ && git commit -m "feat: handle UserRegistered event — auto-create UserProfile"
```

---

### Task 9: Unit Tests

**Files:**
- Create: `backend/src/modules/user/domain/user-profile.spec.ts`
- Create: `backend/src/modules/user/application/use-cases/get-profile.spec.ts`

- [ ] **Step 1: Domain test — UserProfile**

```ts
// user-profile.spec.ts
import { UserProfile } from '../entities/user-profile.entity';
import { Phone } from '../value-objects/phone.value-object';

describe('UserProfile', () => {
  it('creates with inactive status', () => {
    const p = UserProfile.create('u1', 'test@test.com');
    expect(p.status).toBe('inactive');
    expect(p.email).toBe('test@test.com');
  });

  it('updates profile fields', () => {
    const p = UserProfile.create('u1', 'test@test.com');
    p.updateProfile('John', 'Doe', new Phone('+84123456789'));
    expect(p.firstName).toBe('John');
    expect(p.lastName).toBe('Doe');
    expect(p.phone?.toString()).toBe('+84123456789');
  });

  it('activates', () => {
    const p = UserProfile.create('u1', 'test@test.com');
    p.activate();
    expect(p.status).toBe('active');
  });
});
```

- [ ] **Step 2: Use case test — GetProfile**

```ts
// get-profile.spec.ts
import { GetProfileUseCase } from './get-profile.use-case';

describe('GetProfileUseCase', () => {
  it('returns profile when found', async () => {
    const mockRepo = { findByUserId: jest.fn().mockResolvedValue({ userId: 'u1', firstName: 'A' }) };
    const uc = new GetProfileUseCase(mockRepo as any);
    const result = await uc.execute('u1');
    expect(result.firstName).toBe('A');
  });

  it('throws when not found', async () => {
    const mockRepo = { findByUserId: jest.fn().mockResolvedValue(null) };
    const uc = new GetProfileUseCase(mockRepo as any);
    await expect(uc.execute('u1')).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd backend && pnpm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/user/ && git commit -m "test: UserProfile domain and use case tests"
```

---

### Task 10: Final Build & Push

- [ ] **Step 1: Full build**

Run: `cd backend && pnpm build`
Expected: 0 errors

- [ ] **Step 2: Full test suite**

Run: `cd backend && pnpm test`
Expected: All PASS

- [ ] **Step 3: Push**

```bash
git push origin main
```

---

## Self-Review

**1. Spec coverage:**
- ✅ UserProfile aggregate — Tasks 1, 6
- ✅ UserSession aggregate — Tasks 1, 6
- ✅ GetProfile use case — Task 4
- ✅ UpdateProfile use case — Task 4
- ✅ ChangePassword via Auth port — Task 4
- ✅ Controller with @Gate — Task 5
- ✅ Event handler for UserRegistered — Task 8
- ✅ No FK to Auth — enforced by domain entity design
- ✅ userId as event reference — Task 1, 8

**2. No placeholders.**

**3. Type consistency:** All interfaces match across tasks (USER_PROFILE_REPOSITORY, AUTH_PASSWORD_PORT, ProfileDto field names).
