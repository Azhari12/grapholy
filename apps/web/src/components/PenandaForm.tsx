import { useState } from "react";
import type { Penanda } from "../api/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { savePenanda } from "../api/client";
import { Save } from "lucide-react";

interface Props {
  penanda: Penanda;
  onChange: (p: Penanda) => void;
}

export function PenandaForm({ penanda, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = (k: keyof Penanda, v: string) => onChange({ ...penanda, [k]: v });

  const handleSave = async () => {
    setSaving(true);
    try {
      await savePenanda(penanda);
    } catch (e) {
      console.error("save penanda failed", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Penanda</CardTitle>
        <button
          className="text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          {open ? "Tutup" : "Edit"}
        </button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Nama</label>
              <Input value={penanda.nama} onChange={(e) => update("nama", e.target.value)} />
            </div>
            <div>
              <label className="label">NIP</label>
              <Input value={penanda.nip} onChange={(e) => update("nip", e.target.value)} />
            </div>
            <div>
              <label className="label">Jabatan</label>
              <Input value={penanda.jabatan} onChange={(e) => update("jabatan", e.target.value)} />
            </div>
            <div>
              <label className="label">Unit Kerja</label>
              <Input value={penanda.unit_kerja} onChange={(e) => update("unit_kerja", e.target.value)} />
            </div>
            <div>
              <label className="label">Instansi</label>
              <Input value={penanda.instansi} onChange={(e) => update("instansi", e.target.value)} />
            </div>
            <div>
              <label className="label">Nama Kepala</label>
              <Input value={penanda.nama_kepala} onChange={(e) => update("nama_kepala", e.target.value)} />
            </div>
            <div>
              <label className="label">NIP Kepala</label>
              <Input value={penanda.nip_kepala} onChange={(e) => update("nip_kepala", e.target.value)} />
            </div>
          </div>
          <Button variant="secondary" onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            <Save className="h-4 w-4" />
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
