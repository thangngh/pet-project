import { Entity, Column, PrimaryColumn, Index } from 'typeorm';

/**
 * One `outbox_messages` table per bounded context schema, not one shared table.
 *
 * This single class is registered under each producing context's connection,
 * and each data source carries its own `schema`, so the same entity resolves
 * to `auth.outbox_messages` and `catalog.outbox_messages`. A context that
 * later moves to its own database (D4) takes its outbox with it; a shared
 * table would be exactly the cross-context coupling D4 removed.
 */
@Entity('outbox_messages')
export class OutboxMessage {
  @PrimaryColumn('uuid')
  id: string;

  /** The class name, resolved back through the explicit event registry. */
  @Column()
  eventName: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'timestamptz' })
  occurredOn: Date;

  /** Null until delivered. The poller's only filter. */
  @Index('IDX_outbox_messages_dispatchedAt_occurredOn')
  @Column({ type: 'timestamptz', nullable: true })
  dispatchedAt: Date | null;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  /** Drives the backoff, so a failing message does not spin every tick. */
  @Column({ type: 'timestamptz', nullable: true })
  lastAttemptAt: Date | null;

  /**
   * Carried from the request that produced the event, so a message stuck in
   * the outbox can be traced back to what caused it.
   */
  @Column({ type: 'text', nullable: true })
  correlationId: string | null;
}
