package org.memphiszoo.custodial.data

import android.content.Context
import androidx.room.Room
import androidx.room.RoomDatabase

object CustodialDatabaseFactory {
    const val DATABASE_NAME = "memphis-zoo-custodial-native.db"

    fun open(context: Context): CustodialDatabase = Room.databaseBuilder(
        context.applicationContext,
        CustodialDatabase::class.java,
        DATABASE_NAME,
    )
        .setJournalMode(RoomDatabase.JournalMode.WRITE_AHEAD_LOGGING)
        .build()
}
