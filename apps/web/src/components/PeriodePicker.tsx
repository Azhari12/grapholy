import type { Periode } from "../api/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Input } from "./ui/Input";

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

interface Props {
  periode: Periode;
  onChange: (p: Periode) => void;
  tahunNow: number;
}

export function PeriodePicker({ periode, onChange, tahunNow }: Props) {
  const tahunOpts = [tahunNow, tahunNow - 1, tahunNow - 2];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Periode</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <button
            className={`btn ${periode.mode === "bulan" ? "btn-primary" : "btn-secondary"}`}
            onClick={() =>
              onChange({ mode: "bulan", bulan: new Date().getMonth() + 1, tahun: tahunNow })
            }
          >
            Bulan
          </button>
          <button
            className={`btn ${periode.mode === "custom" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => onChange({ mode: "custom", dari: "", sampai: "" })}
          >
            Custom Range
          </button>
        </div>

        {periode.mode === "bulan" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Bulan</label>
              <select
                className="input"
                value={periode.bulan}
                onChange={(e) => onChange({ ...periode, bulan: Number(e.target.value) })}
              >
                {BULAN.map((b, i) => (
                  <option key={b} value={i + 1}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Tahun</label>
              <select
                className="input"
                value={periode.tahun}
                onChange={(e) => onChange({ ...periode, tahun: Number(e.target.value) })}
              >
                {tahunOpts.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Tanggal TTD (opsional)</label>
              <Input
                type="date"
                value={periode.tanggal_ttd ?? ""}
                onChange={(e) => onChange({ ...periode, tanggal_ttd: e.target.value })}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Dari</label>
              <Input
                type="date"
                value={periode.dari}
                onChange={(e) => onChange({ ...periode, dari: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Sampai</label>
              <Input
                type="date"
                value={periode.sampai}
                onChange={(e) => onChange({ ...periode, sampai: e.target.value })}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
