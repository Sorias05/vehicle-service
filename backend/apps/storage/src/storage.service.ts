import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { In, Repository } from 'typeorm';

import { FileEntity, FileStatus } from '@app/database/entities/file.entity';
import { S3_CLIENT } from '@app/s3';

import { UploadFileDto } from './create-upload-url.dto';

@Injectable()
export class StorageService {
  private bucket: string;

  constructor(
    @Inject(S3_CLIENT)
    private readonly s3: S3Client,
    private readonly configService: ConfigService,
    @InjectRepository(FileEntity)
    private readonly fileRepository: Repository<FileEntity>,
  ) {
    this.bucket = this.configService.getOrThrow<string>('AWS_S3_BUCKET');
  }

  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[/\\?%*:|"<>]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 255);
  }

  async createUploadUrls(userId: number, files: UploadFileDto[]) {
    const allowedTypes = this.configService
      .getOrThrow<string>('STORAGE_ALLOWED_CONTENT_TYPES')
      .split(',')
      .map((type) => type.trim());

    const expiresIn = this.configService.getOrThrow<number>(
      'STORAGE_UPLOAD_URL_EXPIRES_IN',
    );

    for (const file of files) {
      if (!allowedTypes.includes(file.contentType)) {
        throw new BadRequestException(
          `Content type is not allowed: ${file.contentType}`,
        );
      }
    }

    return Promise.all(
      files.map(async (file) => {
        const key = `users/${userId}/${randomUUID()}-${this.sanitizeFilename(file.filename)}`;

        const entity = await this.fileRepository.save({
          userId,
          key,
          originalName: file.filename,
          contentType: file.contentType,
          size: file.size,
          status: FileStatus.PENDING,
        });

        const command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ContentType: file.contentType,
          ContentLength: file.size,
        });

        const uploadUrl = await getSignedUrl(this.s3, command, {
          expiresIn,
        });

        return {
          fileId: entity.id,
          uploadUrl,
          expiresIn,
        };
      }),
    );
  }

  async completeUploads(userId: number, fileIds: number[]) {
    const files = await this.fileRepository.find({
      where: {
        id: In(fileIds),
        userId,
        status: FileStatus.PENDING,
      },
    });

    if (files.length !== fileIds.length) {
      throw new NotFoundException('One or more pending files were not found');
    }

    const results = await Promise.all(
      files.map(async (file) => {
        try {
          const result = await this.s3.send(
            new HeadObjectCommand({
              Bucket: this.bucket,
              Key: file.key,
            }),
          );

          file.size = result.ContentLength ?? file.size;

          file.status = FileStatus.READY;

          await this.fileRepository.save(file);

          return {
            fileId: file.id,
            status: FileStatus.READY,
            size: file.size,
          };
        } catch {
          return {
            fileId: file.id,
            status: FileStatus.PENDING,
          };
        }
      }),
    );

    return {
      files: results,
    };
  }

  async getFiles(userId: number, page: number, limit: number) {
    const [files, total] = await this.fileRepository.findAndCount({
      where: { userId },
      order: {
        createdAt: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        originalName: true,
        contentType: true,
        size: true,
        status: true,
        createdAt: true,
      },
    });

    return {
      files,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createDownloadUrls(userId: number, fileIds: number[]) {
    const files = await this.fileRepository.find({
      where: {
        id: In(fileIds),
        userId,
        status: FileStatus.READY,
      },
    });

    if (files.length !== fileIds.length) {
      throw new NotFoundException('One or more files were not found');
    }

    const result = await Promise.all(
      files.map(async (file) => {
        const command = new GetObjectCommand({
          Bucket: this.bucket,
          Key: file.key,
          ResponseContentType: file.contentType,
          ResponseContentDisposition: `inline; filename="${file.originalName}"`,
        });

        const downloadUrl = await getSignedUrl(this.s3, command, {
          expiresIn: 300,
        });

        return {
          fileId: file.id,
          downloadUrl,
          expiresIn: 300,
        };
      }),
    );

    return {
      files: result,
    };
  }

  async deleteFiles(userId: number, fileIds: number[]) {
    const files = await this.fileRepository.find({
      where: {
        id: In(fileIds),
        userId,
      },
    });

    if (files.length !== fileIds.length) {
      throw new NotFoundException('One or more files were not found');
    }

    const command = new DeleteObjectsCommand({
      Bucket: this.bucket,
      Delete: {
        Objects: files.map((file) => ({
          Key: file.key,
        })),
        Quiet: false,
      },
    });

    const result = await this.s3.send(command);

    if (result.Errors?.length) {
      throw new BadRequestException({
        message: 'Some files could not be deleted',
        errors: result.Errors,
      });
    }

    await this.fileRepository.delete({
      id: In(fileIds),
      userId,
    });

    return {
      deleted: files.map((file) => file.id),
    };
  }
}
