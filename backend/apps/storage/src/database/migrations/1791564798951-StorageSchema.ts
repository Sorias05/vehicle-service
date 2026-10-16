import { MigrationInterface, QueryRunner } from 'typeorm';

export class StorageSchema1791564798951 implements MigrationInterface {
  name = 'StorageSchema1791564798951';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."file_status_enum" AS ENUM('pending', 'ready', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "file" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "key" character varying NOT NULL, "originalName" character varying NOT NULL, "contentType" character varying NOT NULL, "size" bigint, "status" "public"."file_status_enum" NOT NULL DEFAULT 'pending', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_36b46d232307066b3a2c9ea3a1d" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "file"`);
    await queryRunner.query(`DROP TYPE "public"."file_status_enum"`);
  }
}
