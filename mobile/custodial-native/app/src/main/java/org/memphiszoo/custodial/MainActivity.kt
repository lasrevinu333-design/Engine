package org.memphiszoo.custodial

import android.content.Intent
import android.nfc.NfcAdapter
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.lifecycle.lifecycleScope
import org.memphiszoo.custodial.domain.ScanSource
import org.memphiszoo.custodial.nfc.AndroidNfcController
import org.memphiszoo.custodial.ui.CustodialFoundationApp

class MainActivity : ComponentActivity() {
    private val applicationGraph: CustodialApplication
        get() = application as CustodialApplication

    private lateinit var nfcController: AndroidNfcController

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        nfcController = AndroidNfcController(this, lifecycleScope, applicationGraph.coordinator)
        setContent {
            val state by applicationGraph.coordinator.state.collectAsState()
            CustodialFoundationApp(
                state = state,
                onUnlock = applicationGraph.coordinator::unlock,
                onStartCleaning = applicationGraph.coordinator::startCleaning,
                onFinishCleaning = applicationGraph.coordinator::finishCleaning,
                onFinishNoteChanged = applicationGraph.coordinator::updateFinishNote,
                onNotNow = applicationGraph.coordinator::dismissScan,
                onNeedHelp = applicationGraph.coordinator::requestManagerHelp,
                onTryAgain = applicationGraph::retryCurrentAction,
                onDismissNotice = applicationGraph.coordinator::clearNotice,
            )
        }
        if (intent?.action == NfcAdapter.ACTION_NDEF_DISCOVERED) {
            nfcController.handleIntent(intent, ScanSource.COLD_INTENT)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        nfcController.handleIntent(intent, ScanSource.WARM_INTENT)
    }

    override fun onResume() {
        super.onResume()
        nfcController.enableReaderMode()
    }

    override fun onPause() {
        nfcController.disableReaderMode()
        super.onPause()
    }

    override fun onStop() {
        if (!isChangingConfigurations) applicationGraph.coordinator.lock()
        super.onStop()
    }

    override fun onDestroy() {
        nfcController.close()
        super.onDestroy()
    }
}
