package com.prati.meugasto

import android.app.Application
import com.prati.meugasto.data.local.database.AppDatabase
import com.prati.meugasto.data.local.preferences.UserPreferences
import com.prati.meugasto.data.remote.supabase.CloudPurchaseSync
import com.prati.meugasto.data.remote.supabase.CloudPurchaseUploader
import com.prati.meugasto.data.remote.supabase.CloudSyncManager
import com.prati.meugasto.data.remote.supabase.SupabaseApi
import com.prati.meugasto.data.remote.supabase.SupabaseAuthRepository
import com.prati.meugasto.data.repository.LocalPurchaseRepository
import com.prati.meugasto.data.repository.PurchaseRepository

class MeuGastoApp : Application() {

    lateinit var database: AppDatabase
        private set

    lateinit var preferences: UserPreferences
        private set

    lateinit var purchaseRepository: PurchaseRepository
        private set

    lateinit var supabaseApi: SupabaseApi
        private set

    lateinit var authRepository: SupabaseAuthRepository
        private set

    lateinit var cloudSyncManager: CloudSyncManager
        private set

    lateinit var cloudUploader: CloudPurchaseUploader
        private set

    override fun onCreate() {
        super.onCreate()
        database = AppDatabase.getInstance(this)
        preferences = UserPreferences(this)
        purchaseRepository = LocalPurchaseRepository(database)

        supabaseApi = SupabaseApi(BuildConfig.SUPABASE_URL, BuildConfig.SUPABASE_ANON_KEY)
        authRepository = SupabaseAuthRepository(supabaseApi, preferences)
        cloudSyncManager = CloudSyncManager(
            api = supabaseApi,
            auth = authRepository,
            sync = CloudPurchaseSync(database)
        )
        cloudUploader = CloudPurchaseUploader(
            api = supabaseApi,
            auth = authRepository,
            database = database
        )
    }
}
