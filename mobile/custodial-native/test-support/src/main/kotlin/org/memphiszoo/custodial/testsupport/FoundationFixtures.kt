package org.memphiszoo.custodial.testsupport

import org.memphiszoo.custodial.domain.ActiveCleaning
import org.memphiszoo.custodial.domain.EmployeeIdentity
import org.memphiszoo.custodial.domain.EmployeeUiState

object FoundationFixtures {
    val KarenIdle = EmployeeUiState(
        identity = EmployeeIdentity("fixture-karen", "Karen Robinson"),
        activeCleaning = null,
    )
    val KarenCleaning = KarenIdle.copy(
        activeCleaning = ActiveCleaning("fixture-start", "TETM", "Teton Men's Restroom"),
    )
}
