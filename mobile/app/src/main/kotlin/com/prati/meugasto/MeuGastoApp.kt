package com.prati.meugasto

import android.app.Application
import com.prati.meugasto.data.local.database.AppDatabase
import com.prati.meugasto.data.local.preferences.UserPreferences
import com.prati.meugasto.data.repository.LocalPurchaseRepository
import com.prati.meugasto.data.repository.UnifiedPurchaseRepository

class MeuGastoApp : Application() {

    lateinit var database: AppDatabase
        private set

    lateinit var preferences: UserPreferences
        private set

    lateinit var purchaseRepository: UnifiedPurchaseRepository
        private set

    override fun onCreate() {
        super.onCreate()
        database = AppDatabase.getInstance(this)
        preferences = UserPreferences(this)
        val localRepo = LocalPurchaseRepository(database)
        purchaseRepository = UnifiedPurchaseRepository(localRepo, preferences)
    }
}

