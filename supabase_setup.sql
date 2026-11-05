-- ================================================
-- ContratoPro — Setup Supabase
-- Execute no SQL Editor do Supabase Dashboard
-- ================================================

-- 0. Tabela de perfis de usuário (autenticação)
CREATE TABLE IF NOT EXISTS profiles (
  id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome  TEXT NOT NULL,
  role  TEXT NOT NULL DEFAULT 'visualizador' CHECK (role IN ('admin', 'visualizador')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger: cria perfil automaticamente ao criar usuário no Auth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, nome, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email), 'visualizador')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Usuário admin de teste (substitua pelo e-mail real após criar no Auth)
-- UPDATE profiles SET role = 'admin', nome = 'Willian Macedo'
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'seu@email.com');

-- 1. Tabela secretarias (se não existir)
CREATE TABLE IF NOT EXISTS secretarias (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome       TEXT NOT NULL,
  municipio  TEXT NOT NULL,
  whatsapp   TEXT,
  email      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Adicionar coluna whatsapp (se a tabela já existia sem ela)
ALTER TABLE secretarias ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE secretarias ADD COLUMN IF NOT EXISTS email    TEXT;

-- 3. Tabela contratos (se não existir)
CREATE TABLE IF NOT EXISTS contratos (
  id                       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_contrato          TEXT NOT NULL,
  numero_controle_pncp     TEXT UNIQUE,
  fornecedor               TEXT NOT NULL,
  fornecedor_cnpj          TEXT,
  fornecedor_situacao      TEXT,
  fornecedor_verificado_em TIMESTAMPTZ,
  objeto                   TEXT NOT NULL,
  tipo_objeto              TEXT DEFAULT 'servico',
  valor_total              NUMERIC(15,2) NOT NULL DEFAULT 0,
  data_inicio              DATE NOT NULL,
  data_vencimento          DATE NOT NULL,
  responsavel              TEXT,
  fiscal_nome              TEXT,
  fiscal_whatsapp          TEXT,
  secretario_nome          TEXT,
  secretario_whatsapp      TEXT,
  status                   TEXT DEFAULT 'ativo',
  secretaria_id            UUID REFERENCES secretarias(id),
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Contato de teste para notificações WhatsApp
INSERT INTO secretarias (nome, municipio, whatsapp, email)
VALUES
  ('Secretaria Municipal de Administração', 'Porto Alegre - RS', '51900000000', 'admin@portoalegre.rs.gov.br'),
  ('Secretaria de Educação',                'Porto Alegre - RS', '51900000000', 'educacao@portoalegre.rs.gov.br'),
  ('Secretaria de Saúde',                   'Porto Alegre - RS', '51900000000', 'saude@portoalegre.rs.gov.br')
ON CONFLICT DO NOTHING;

-- 5. Contratos de exemplo para demonstração
INSERT INTO contratos (numero_contrato, fornecedor, fornecedor_cnpj, objeto, tipo_objeto, valor_total, data_inicio, data_vencimento, responsavel, status, secretaria_id)
SELECT
  '001/2024',
  'Tech Solutions Ltda',
  '12345678000195',
  'Fornecimento de licenças de software para gestão administrativa',
  'software',
  85000.00,
  '2024-01-15',
  '2025-01-15',
  'Willian Macedo',
  'vencido',
  s.id
FROM secretarias s WHERE s.nome = 'Secretaria Municipal de Administração' LIMIT 1;

INSERT INTO contratos (numero_contrato, fornecedor, fornecedor_cnpj, objeto, tipo_objeto, valor_total, data_inicio, data_vencimento, responsavel, status, secretaria_id)
SELECT
  '002/2025',
  'Construtora Horizonte SA',
  '98765432000121',
  'Reforma e manutenção das instalações da secretaria de educação',
  'obra',
  320000.00,
  '2025-03-01',
  '2026-05-10',
  'Willian Macedo',
  'vencendo',
  s.id
FROM secretarias s WHERE s.nome = 'Secretaria de Educação' LIMIT 1;

INSERT INTO contratos (numero_contrato, fornecedor, fornecedor_cnpj, objeto, tipo_objeto, valor_total, data_inicio, data_vencimento, responsavel, status, secretaria_id)
SELECT
  '003/2025',
  'MedSupply Distribuidora',
  '45678901000167',
  'Fornecimento de materiais e insumos hospitalares',
  'material',
  150000.00,
  '2025-01-10',
  '2026-12-31',
  'Willian Macedo',
  'ativo',
  s.id
FROM secretarias s WHERE s.nome = 'Secretaria de Saúde' LIMIT 1;

INSERT INTO contratos (numero_contrato, fornecedor, fornecedor_cnpj, objeto, tipo_objeto, valor_total, data_inicio, data_vencimento, responsavel, status, secretaria_id)
SELECT
  '004/2025',
  'DataCenter Cloud Ltda',
  '56789012000134',
  'Serviços de hospedagem em nuvem e suporte técnico',
  'servico',
  48000.00,
  '2025-04-01',
  '2026-04-30',
  'Willian Macedo',
  'ativo',
  s.id
FROM secretarias s WHERE s.nome = 'Secretaria Municipal de Administração' LIMIT 1;

INSERT INTO contratos (numero_contrato, fornecedor, fornecedor_cnpj, objeto, tipo_objeto, valor_total, data_inicio, data_vencimento, responsavel, status, secretaria_id)
SELECT
  '005/2025',
  'Gráfica Comunicação Visual',
  '67890123000112',
  'Impressão de materiais didáticos e apostilas escolares',
  'material',
  28500.00,
  '2025-02-01',
  '2026-04-28',
  'Willian Macedo',
  'vencendo',
  s.id
FROM secretarias s WHERE s.nome = 'Secretaria de Educação' LIMIT 1;
