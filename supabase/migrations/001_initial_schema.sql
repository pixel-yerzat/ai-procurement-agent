-- Suppliers
create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  language text not null default 'ru',
  created_at timestamptz not null default now()
);

-- Messages (conversation history)
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  direction text not null check (direction in ('IN', 'OUT')),
  body text not null,
  created_at timestamptz not null default now()
);

-- Documents (attachments received from suppliers)
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  message_id uuid references messages(id) on delete set null,
  type text not null, -- pdf | docx | xlsx | image
  file_path text not null,
  parsed_text text,
  ocr_confidence float,
  created_at timestamptz not null default now()
);

-- Offers extracted by AI
create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  document_id uuid references documents(id) on delete set null,
  items jsonb not null default '[]',
  delivery_days int,
  payment_terms text,
  valid_until date,
  notes text,
  missing_fields text[] not null default '{}',
  received_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_messages_supplier_id on messages(supplier_id);
create index if not exists idx_documents_supplier_id on documents(supplier_id);
create index if not exists idx_offers_supplier_id on offers(supplier_id);
