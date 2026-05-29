-- ================================================
-- ContratoPro — Fix: Import PNCP
-- Execute no SQL Editor do Supabase Dashboard
-- ================================================

-- 1. Adicionar colunas que faltam na tabela contratos
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS numero_controle_pncp TEXT;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS fiscal_nome           TEXT;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS fiscal_whatsapp       TEXT;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS secretario_nome       TEXT;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS secretario_whatsapp   TEXT;

-- 2. Remover constraint antiga e recriar como UNIQUE CONSTRAINT completo
--    (DROP CONSTRAINT já remove o índice vinculado automaticamente)
ALTER TABLE contratos
  DROP CONSTRAINT IF EXISTS contratos_numero_controle_pncp_key;

ALTER TABLE contratos
  DROP CONSTRAINT IF EXISTS contratos_numero_controle_pncp_unique;

ALTER TABLE contratos
  ADD CONSTRAINT contratos_numero_controle_pncp_unique
  UNIQUE (numero_controle_pncp);

-- 3. Habilitar RLS
ALTER TABLE contratos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE secretarias ENABLE ROW LEVEL SECURITY;

-- 4. Políticas para contratos
DROP POLICY IF EXISTS "contratos_select_all"  ON contratos;
DROP POLICY IF EXISTS "contratos_insert_all"  ON contratos;
DROP POLICY IF EXISTS "contratos_update_all"  ON contratos;
DROP POLICY IF EXISTS "contratos_delete_auth" ON contratos;

CREATE POLICY "contratos_select_all"  ON contratos FOR SELECT USING (true);
CREATE POLICY "contratos_insert_all"  ON contratos FOR INSERT WITH CHECK (true);
CREATE POLICY "contratos_update_all"  ON contratos FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "contratos_delete_auth" ON contratos FOR DELETE USING (true);

-- 5. Políticas para secretarias
DROP POLICY IF EXISTS "secretarias_select_all"  ON secretarias;
DROP POLICY IF EXISTS "secretarias_insert_all"  ON secretarias;
DROP POLICY IF EXISTS "secretarias_update_all"  ON secretarias;
DROP POLICY IF EXISTS "secretarias_delete_auth" ON secretarias;

CREATE POLICY "secretarias_select_all"  ON secretarias FOR SELECT USING (true);
CREATE POLICY "secretarias_insert_all"  ON secretarias FOR INSERT WITH CHECK (true);
CREATE POLICY "secretarias_update_all"  ON secretarias FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "secretarias_delete_auth" ON secretarias FOR DELETE USING (true);

-- 6. Verificação: confirme que a constraint foi criada
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'contratos'
  AND constraint_name = 'contratos_numero_controle_pncp_unique';
