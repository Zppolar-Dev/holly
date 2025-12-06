# 🔄 Configuração de Sincronização Bot ↔ Website

## Problema

Quando o bot roda localmente e o website em produção (ou vice-versa), eles usam arquivos diferentes:
- **Bot local**: `C:\Users\...\server\data\servers.json`
- **Website produção**: `/opt/render/project/src/server/data/servers.json`

## Soluções

### Opção 1: Mesmo Ambiente (Recomendado para desenvolvimento)

Execute ambos no mesmo ambiente:
- **Local**: Bot e website rodando na mesma máquina
- **Produção**: Bot e website rodando no mesmo servidor

### Opção 2: Variável de Ambiente (Para produção)

Configure a variável `DATA_FILE_PATH` para ambos apontarem para o mesmo local:

**No Render (Website):**
```env
DATA_FILE_PATH=/opt/render/project/src/server/data/servers.json
```

**No bot (se rodar separado):**
```env
DATA_FILE_PATH=/opt/render/project/src/server/data/servers.json
```

### Opção 3: API de Sincronização (Futuro)

Para ambientes completamente separados, use uma API de sincronização (requer implementação adicional).

## Configuração Atual

O código agora detecta automaticamente:
- Se `DATA_FILE_PATH` está definido, usa esse caminho
- Caso contrário, usa o caminho padrão relativo ao projeto

## Verificação

Para verificar se está funcionando:

1. **Local**: Ambos devem salvar em:
   ```
   C:\Users\s2sta\OneDrive\Web Pages\Holly\server\data\servers.json
   ```

2. **Produção**: Ambos devem salvar em:
   ```
   /opt/render/project/src/server/data/servers.json
   ```

## Próximos Passos

Para sincronização entre ambientes diferentes, considere:
- Banco de dados compartilhado (PostgreSQL, MongoDB)
- Serviço de armazenamento na nuvem (S3, etc)
- API de sincronização dedicada

