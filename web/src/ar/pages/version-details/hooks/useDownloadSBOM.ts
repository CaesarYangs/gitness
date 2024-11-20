/*
 * Copyright 2024 Harness, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useState } from 'react'
import { defaultTo } from 'lodash-es'
import { useToaster } from '@harnessio/uicore'
import { downloadSbom } from '@harnessio/react-ssca-manager-client'

import { useAppStore } from '@ar/hooks'
import { useStrings } from '@ar/frameworks/strings'
import { downloadRawFile } from '@ar/utils/downloadRawFile'

export default function useDownloadSBOM() {
  const [loading, setLoading] = useState(false)
  const { scope } = useAppStore()
  const { showError } = useToaster()
  const { getString } = useStrings()

  const download = async (orchestrationId: string) => {
    setLoading(true)
    return downloadSbom({
      org: defaultTo(scope.orgIdentifier, ''),
      project: defaultTo(scope.projectIdentifier, ''),
      'orchestration-id': orchestrationId
    })
      .then(data => {
        const content = defaultTo(data.content.sbom, '')
        if (!content) {
          throw new Error(getString('versionDetails.cards.supplyChain.SBOMDataNotAvailable'))
        }
        return downloadRawFile(content, `sbom_${orchestrationId}.json`)
      })
      .catch((err: Error) => {
        showError(defaultTo(err?.message, err))
        return false
      })
      .finally(() => {
        setLoading(false)
      })
  }

  return { download, loading }
}