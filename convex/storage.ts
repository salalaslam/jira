"use node";

import {
	CreateBucketCommand,
	DeleteObjectCommand,
	GetObjectCommand,
	HeadBucketCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { assertFileSize, sanitizeFileName } from "./storageHelpers";

let bucketReady = false;

function requireEnv(name: string) {
	const value = process.env[name]?.trim();
	if (!value) {
		throw new Error(`Missing ${name} — set it in the Convex dashboard`);
	}
	return value;
}

export function getMinioConfig() {
	const endpoint = requireEnv("MINIO_ENDPOINT").replace(/\/$/, "");
	const accessKeyId = requireEnv("MINIO_ACCESS_KEY");
	const secretAccessKey = requireEnv("MINIO_SECRET_KEY");
	const bucket = requireEnv("MINIO_BUCKET");
	const publicUrl = (process.env.MINIO_PUBLIC_URL ?? endpoint).replace(/\/$/, "");

	return { endpoint, accessKeyId, secretAccessKey, bucket, publicUrl };
}

function createS3Client() {
	const { endpoint, accessKeyId, secretAccessKey } = getMinioConfig();
	return new S3Client({
		endpoint,
		region: "us-east-1",
		credentials: { accessKeyId, secretAccessKey },
		forcePathStyle: true,
	});
}

async function ensureBucket(client: S3Client, bucket: string) {
	if (bucketReady) return;
	try {
		await client.send(new HeadBucketCommand({ Bucket: bucket }));
	} catch {
		await client.send(new CreateBucketCommand({ Bucket: bucket }));
	}
	bucketReady = true;
}

function withPublicHost(url: string) {
	const { endpoint, publicUrl } = getMinioConfig();
	if (publicUrl === endpoint) return url;
	return url.replace(endpoint, publicUrl);
}

export async function createUploadUrl(
	objectKey: string,
	contentType: string,
	size: number,
) {
	assertFileSize(size);
	const { bucket } = getMinioConfig();
	const client = createS3Client();
	await ensureBucket(client, bucket);

	const command = new PutObjectCommand({
		Bucket: bucket,
		Key: objectKey,
		ContentType: contentType || "application/octet-stream",
		ContentLength: size,
	});

	const uploadUrl = await getSignedUrl(client, command, { expiresIn: 60 * 15 });
	return withPublicHost(uploadUrl);
}

export async function createDownloadUrl(objectKey: string, fileName: string) {
	const { bucket } = getMinioConfig();
	const client = createS3Client();
	await ensureBucket(client, bucket);

	const command = new GetObjectCommand({
		Bucket: bucket,
		Key: objectKey,
		ResponseContentDisposition: `attachment; filename="${sanitizeFileName(fileName)}"`,
	});

	const downloadUrl = await getSignedUrl(client, command, { expiresIn: 60 * 60 });
	return withPublicHost(downloadUrl);
}

export async function deleteObject(objectKey: string) {
	const { bucket } = getMinioConfig();
	const client = createS3Client();
	await client.send(
		new DeleteObjectCommand({
			Bucket: bucket,
			Key: objectKey,
		}),
	);
}
