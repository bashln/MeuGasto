package com.prati.meugasto

import android.app.Application
import com.prati.meugasto.data.local.database.AppDatabase
import com.prati.meugasto.data.local.preferences.UserPreferences
import com.prati.meugasto.data.repository.LocalPurchaseRepository
import com.prati.meugasto.data.repository.PurchaseRepository

class MeuGastoApp : Application() {

    lateinit var database: AppDatabase
        private set

    lateinit var preferences: UserPreferences
        private set

    lateinit var purchaseRepository: PurchaseRepository
        private set

    override fun onCreate() {
        super.onCreate()
        database = AppDatabase.getInstance(this)
        preferences = UserPreferences(this)
        purchaseRepository = LocalPurchaseRepository(database)
    }
}

