import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storagePut = vi.fn(async (key: string) => ({ key: `managed/${key}`, url: `/manus-storage/managed/${key}` }));
const storageGetSignedUrl = vi.fn(async (key: string) => `https://signed.example.test/${key}`);

vi.mock("../storage", () => ({ storagePut, storageGetSignedUrl }));

const { getPrivateDocumentUrl, getPrivateStorageStatus, putPrivateDocument } = await import("./privateStorage");
const originalEnv = { ...process.env };

describe("private document storage adapter", () => {
  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: "development" };
    delete process.env.PRIVATE_STORAGE_MODE;
    delete process.env.STORAGE_BUCKET;
    delete process.env.STORAGE_REGION;
    delete process.env.STORAGE_ACCESS_KEY_ID;
    delete process.env.STORAGE_SECRET_ACCESS_KEY;
    storagePut.mockClear();
    storageGetSignedUrl.mockClear();
  });

  afterEach(() => { process.env = { ...originalEnv }; });

  it("uses the managed private-storage adapter during development", async () => {
    expect(getPrivateStorageStatus()).toEqual({ mode: "managed", configured: true, missing: [] });
    await expect(putPrivateDocument("private/17/cv.pdf", Buffer.from("cv"), "application/pdf")).resolves.toEqual({ key: "managed/private/17/cv.pdf", url: "/manus-storage/managed/private/17/cv.pdf" });
    await expect(getPrivateDocumentUrl("private/17/cv.pdf")).resolves.toBe("https://signed.example.test/private/17/cv.pdf");
    expect(storagePut).toHaveBeenCalledWith("private/17/cv.pdf", expect.any(Buffer), "application/pdf");
  });

  it("fails closed in production status checks when S3-compatible private storage is incomplete", () => {
    process.env.NODE_ENV = "production";
    expect(getPrivateStorageStatus()).toEqual(expect.objectContaining({ mode: "s3", configured: false, missing: expect.arrayContaining(["bucket", "region", "accessKeyId", "secretAccessKey"]) }));
  });

  it("does not treat a private S3 record as a public URL", () => {
    process.env.NODE_ENV = "production";
    process.env.STORAGE_BUCKET = "private-freelancehr";
    process.env.STORAGE_REGION = "ap-south-1";
    process.env.STORAGE_ACCESS_KEY_ID = "test-key";
    process.env.STORAGE_SECRET_ACCESS_KEY = "test-secret";
    expect(getPrivateStorageStatus()).toEqual({ mode: "s3", configured: true, missing: [] });
  });
});
