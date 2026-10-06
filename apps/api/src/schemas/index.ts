import { z } from "zod";

export const penandaSchema = z.object({
  nama: z.string(),
  nip: z.string(),
  jabatan: z.string(),
  unit_kerja: z.string(),
  instansi: z.string(),
  nama_kepala: z.string(),
  nip_kepala: z.string(),
});

export const periodeSchema = z.object({
  mode: z.enum(["bulan", "custom"]),
  bulan: z.number().int().min(1).max(12).optional(),
  tahun: z.number().int().min(2000).max(2100).optional(),
  dari: z.string().optional(), // ISO date, untuk mode custom
  sampai: z.string().optional(),
  tanggal_ttd: z.string().optional(), // override default akhir bulan
});

export const previewRequestSchema = z.object({
  periode: periodeSchema,
  repoIds: z.array(z.string()).min(1),
});

export const generateRequestSchema = z.object({
  periode: periodeSchema,
  repoIds: z.array(z.string()).min(1),
  penanda: penandaSchema.optional(),
  summarizeWithLLM: z.boolean().default(true),
  tanggalTtd: z.string().optional(),
});
