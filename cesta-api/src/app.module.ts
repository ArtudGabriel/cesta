import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { validateEnv } from './config/env.validation';
import { buildRedisConnection } from './config/redis-connection';
import { THROTTLER_CONFIG } from './config/throttler-config';
import { PrismaModule } from './database/prisma.module';
import { AdminModule } from './modules/admin/admin.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { TwoFactorModule } from './modules/auth/two-factor/two-factor.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { CatalogSyncModule } from './modules/catalog-sync/catalog-sync.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { FamilyBasketsModule } from './modules/family-baskets/family-baskets.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { SearchHistoryModule } from './modules/search-history/search-history.module';
import { FamilyProfilesModule } from './modules/family-profiles/family-profiles.module';
import { HealthModule } from './modules/health/health.module';
import { ImportsModule } from './modules/imports/imports.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ProductsModule } from './modules/products/products.module';
import { ReceiptsModule } from './modules/receipts/receipts.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { ShoppingListsModule } from './modules/shopping-lists/shopping-lists.module';
import { StorageModule } from './modules/storage/storage.module';
import { SupermarketsModule } from './modules/supermarkets/supermarkets.module';
import { TelemetryModule } from './modules/telemetry/telemetry.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
    // Sprint 227 (#10/#11+#14+#15 bundle 1): named throttlers em forRoot
    // aplicam-se A TODAS AS ROTAS simultaneamente no @nestjs/throttler v5+
    // (memory feedback-throttler-named-global · bug pattern P0 S98). Antes
    // S227: strict:5/60s global cortava browsing publico apos 5 requests
    // (GET /products, /products/:id, /products/suggest, /favorites, /users/me
    // nao tinham override) — causa cascade dos 3 bugs Boss QA:
    //   #10/#11 /produto/[pid] crasha apos 5 PDPs abertos (fetchProductSSR
    //            throw 429 -> segment error.tsx renderiza "Algo salio mal")
    //   #14 busca dentro /minha-lista autocomplete retorna 0 pos 5 digitadas
    //   #15 bottom nav useProfile isError=true apos 5 refetches -> some
    //
    // Fix: elevar `strict` e `write` globais ao teto pratico (10_000/60s =
    // no-op para trafego legitimo) mantendo nomes registrados. Rotas que
    // precisam de limite apertado continuam declarando @Throttle({strict:
    // {limit:5, ...}}) inline e esse override ganha para a rota especifica.
    // Nao removemos nomes do forRoot porque @Throttle({strict:...}) precisa
    // do nome registrado para ancorar o override.
    // Config centralizada em config/throttler-config.ts + spec anti-regression
    // (throttler-config.spec.ts) trava limites `strict`/`write` em >= 1_000
    // globais pra evitar quarta reaparicao do bug global-leak (S98 +
    // S227 bundle 1). Rotas sensiveis declaram @Throttle inline override.
    ThrottlerModule.forRoot(THROTTLER_CONFIG),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: buildRedisConnection(config.getOrThrow<string>('REDIS_URL')),
      }),
    }),
    PrismaModule,
    StorageModule,
    AuditModule,
    UsersModule,
    AuthModule,
    TwoFactorModule,
    AdminModule,
    SupermarketsModule,
    CategoriesModule,
    ProductsModule,
    ShoppingListsModule,
    ReviewsModule,
    FamilyProfilesModule,
    FamilyBasketsModule,
    AlertsModule,
    NotificationsModule,
    CatalogSyncModule,
    ReceiptsModule,
    ExpensesModule,
    FavoritesModule,
    SearchHistoryModule,
    ImportsModule,
    HealthModule,
    TelemetryModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
