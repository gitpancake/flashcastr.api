-- CreateTable
CREATE TABLE "flash_identifications" (
    "id" SERIAL NOT NULL,
    "source_ipfs_cid" TEXT NOT NULL,
    "matched_flash_id" BIGINT NOT NULL,
    "matched_flash_name" TEXT,
    "similarity" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flash_identifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_flash_identifications_source" ON "flash_identifications"("source_ipfs_cid");

-- CreateIndex
CREATE INDEX "idx_flash_identifications_matched" ON "flash_identifications"("matched_flash_id");

-- AddForeignKey
ALTER TABLE "flash_identifications" ADD CONSTRAINT "flash_identifications_matched_flash_id_fkey" FOREIGN KEY ("matched_flash_id") REFERENCES "flashes"("flash_id") ON DELETE RESTRICT ON UPDATE NO ACTION;
