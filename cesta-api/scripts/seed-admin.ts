/* eslint-disable no-console */
/**
 * Sprint 92: cria/promove um user com role `admin`. Dev-only — aborta em
 * production pra forçar provisioning via console do Render + SQL manual.
 *
 * Uso:
 *   ADMIN_EMAIL=foo@bar.com ADMIN_PASSWORD=secret123 npm run seed:admin
 *
 * Se já existe user com o email, injeta `admin` nos roles. Caso contrário,
 * cria novo user verificado com o password informado.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'seed-admin bloqueado em production — provisione via console + SQL manual.',
    );
  }

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Defina ADMIN_EMAIL + ADMIN_PASSWORD no env antes de rodar seed-admin.',
    );
  }
  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD precisa ter pelo menos 8 caracteres.');
  }

  const prisma = new PrismaClient();
  try {
    const normalized = email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalized } });

    if (existing) {
      if (existing.roles.includes('admin')) {
        console.log(`[seed-admin] user ${existing.id} já é admin.`);
        return;
      }
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: { roles: { set: [...existing.roles, 'admin'] } },
      });
      console.log(
        `[seed-admin] roles atualizados para user ${updated.id}: ${updated.roles.join(',')}`,
      );
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const created = await prisma.user.create({
      data: {
        email: normalized,
        passwordHash,
        name: 'Admin',
        locale: 'es',
        roles: ['user', 'admin'],
        emailVerifiedAt: new Date(),
      },
    });
    console.log(
      `[seed-admin] admin criado: id=${created.id} email=${created.email}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[seed-admin] erro:', err);
  process.exit(1);
});
