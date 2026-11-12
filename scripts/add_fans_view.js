const fs = require('fs');

const path = 'C:/Users/Lenovo/AndroidStudioProjects/kapela_ios_android/src/components/edit-band-form.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Update PageHeader title
content = content.replace(
  `activeTab === 'tech' ? t('header.techRider') : t('header.appSettings')`,
  `activeTab === 'tech' ? t('header.techRider') : activeTab === 'fans' ? t('nav.fans') : t('header.appSettings')`
);

// 2. Add fans view block after settings
const fansViewBlock = `) : activeTab === 'fans' ? (
          <View style={{ gap: Spacing.four }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <ThemedText type="subtitle" style={{ fontSize: 18, fontWeight: 'bold' }}>
                  {t('fans.title', { count: fans.length })}
                </ThemedText>
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                {fans.length > 0 && (
                  <Pressable
                    style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(33,150,243,0.15)', flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    onPress={copyFanEmails}
                  >
                    <SymbolView name={{ ios: 'doc.on.doc', android: 'content_copy', web: 'content_copy' }} size={16} tintColor="#2196f3" />
                    <ThemedText type="smallBold" style={{ color: '#2196f3', fontSize: 12 }}>
                      {t('fans.copyEmails')}
                    </ThemedText>
                  </Pressable>
                )}

                <Pressable
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#4caf50', flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  onPress={() => {
                    setEditingFan(null);
                    setShowAddFanModal(true);
                  }}
                >
                  <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={16} tintColor="#fff" />
                  <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 12 }}>
                    {t('fans.addBtn')}
                  </ThemedText>
                </Pressable>
              </View>
            </View>

            {fans.length > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(200,200,200,0.18)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, gap: 8 }}>
                <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={16} tintColor={theme.textSecondary} />
                <TextInput
                  style={{ flex: 1, color: theme.text, fontSize: 14, padding: 0 }}
                  placeholder={t('fans.searchPlaceholder')}
                  placeholderTextColor={theme.textSecondary}
                  value={fanSearch}
                  onChangeText={setFanSearch}
                />
              </View>
            )}

            {fans.length === 0 ? (
              <ThemedText type="default" themeColor="textSecondary" style={{ textAlign: 'center', marginTop: 20 }}>
                {t('fans.empty')}
              </ThemedText>
            ) : (
              <View style={{ gap: 10 }}>
                {fans
                  .filter(f => !fanSearch.trim() || f.name.toLowerCase().includes(fanSearch.toLowerCase()) || f.email.toLowerCase().includes(fanSearch.toLowerCase()))
                  .map(fan => (
                    <ThemedView key={fan.id} type="backgroundElement" style={{ padding: Spacing.three, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(150,150,150,0.2)', gap: 6 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <ThemedText type="smallBold" style={{ fontSize: 16 }}>{fan.name}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">{fan.email}</ThemedText>
                          {fan.phone ? (
                            <Pressable onPress={() => Linking.openURL(\`tel:\${fan.phone}\`)}>
                              <ThemedText type="small" style={{ color: '#2196f3', marginTop: 2 }}>📞 {fan.phone}</ThemedText>
                            </Pressable>
                          ) : null}
                        </View>

                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <Pressable onPress={() => { setEditingFan(fan); setShowAddFanModal(true); }} style={{ padding: 4 }}>
                            <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} size={18} tintColor="#2196f3" />
                          </Pressable>
                          <Pressable onPress={() => handleDeleteFan(fan)} style={{ padding: 4 }}>
                            <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} size={18} tintColor="#e91e63" />
                          </Pressable>
                        </View>
                      </View>

                      {fan.note ? (
                        <View style={{ marginTop: 4, padding: 6, backgroundColor: 'rgba(150,150,150,0.1)', borderRadius: 6 }}>
                          <ThemedText type="small" style={{ fontStyle: 'italic' }}>
                            💬 {fan.note}
                          </ThemedText>
                        </View>
                      ) : null}

                      {fan.joinedAt ? (
                        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, marginTop: 2 }}>
                          🗓 {t('fans.joinedAt')}: {new Date(fan.joinedAt).toLocaleDateString()}
                        </ThemedText>
                      ) : null}
                    </ThemedView>
                  ))}
              </View>
            )}
          </View>`;

// Replace end of settings view
content = content.replace(
  `) : activeTab === 'tech' ? (`,
  fansViewBlock + `\n        ) : activeTab === 'tech' ? (`
);

// Add AddFanModal right under AddMemberModal
const addFanModalCode = `
      <Modal visible={showAddFanModal} animationType="slide" presentationStyle="pageSheet">
        <AddFanForm
          initialFan={editingFan || undefined}
          onSave={handleSaveFan}
          onCancel={() => {
            setShowAddFanModal(false);
            setEditingFan(null);
          }}
        />
      </Modal>`;

content = content.replace(
  `</Modal>\n\n      {/* Modál pro Stageplan */}`,
  `</Modal>\n${addFanModalCode}\n\n      {/* Modál pro Stageplan */}`
);

fs.writeFileSync(path, content);
console.log('Fans view added to edit-band-form.tsx successfully!');
