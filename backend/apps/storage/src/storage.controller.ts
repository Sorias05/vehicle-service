import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';

import { AuthenticatedUser, CurrentUser } from '@app/authlib';

import {
  CreateUploadUrlsDto,
  FilesDto,
  GetFilesQueryDto,
} from './create-upload-url.dto';
import { StorageService } from './storage.service';

@Controller()
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload-urls')
  createUploadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateUploadUrlsDto,
  ) {
    return this.storageService.createUploadUrls(user.id, body.files);
  }

  @Post('complete')
  completeUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: FilesDto,
  ) {
    return this.storageService.completeUploads(user.id, body.fileIds);
  }

  @Get()
  getFiles(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetFilesQueryDto,
  ) {
    return this.storageService.getFiles(user.id, query.page, query.limit);
  }

  @Get('download-urls')
  downloadUrls(@CurrentUser() user: AuthenticatedUser, @Body() body: FilesDto) {
    return this.storageService.createDownloadUrls(user.id, body.fileIds);
  }

  @Delete()
  deleteFiles(@CurrentUser() user: AuthenticatedUser, @Body() body: FilesDto) {
    return this.storageService.deleteFiles(user.id, body.fileIds);
  }
}
