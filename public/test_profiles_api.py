import unittest
from unittest.mock import MagicMock, patch

import profiles_api


class ProfilesApiTests(unittest.TestCase):
    def test_api_reads_clean_cluster_and_database(self):
        client = MagicMock()
        client['Profiles_cleaned']['Profiles'].find.return_value = iter([{'age': 21}])
        with patch.dict(profiles_api.os.environ, {'MONGODB_TARGET_URI': 'mongodb://clean'}, clear=True), \
             patch.object(profiles_api, '_mongo_client', None), \
             patch.object(profiles_api, '_profiles_cache', None), \
             patch.object(profiles_api, 'MongoClient', return_value=client) as factory:
            self.assertEqual(profiles_api.get_profiles_cached(), [{'age': 21}])
            factory.assert_called_once_with('mongodb://clean')
            client['Profiles_cleaned']['Profiles'].find.assert_called_once_with({}, {'_id': False})

    def test_numeric_height_does_not_get_interpreted_as_a_code(self):
        cleaned = {'age': 21, 'height_inches': 36, 'height_bucket': '3\'0"-3\'3"'}
        self.assertEqual(profiles_api.apply_filters([cleaned], {'height': ["3'0\""]}), [cleaned])
        self.assertEqual(profiles_api.count_attribute_values([cleaned], 'height'), ({'3\'0"-3\'3"': 1}, 1))

    def test_age_filter_accepts_chart_labels_and_rejects_unknown_labels(self):
        rows = [{'age': 18}, {'age': 21}, {'age': 25}, {'age': 46}, {'age': 98}]
        self.assertEqual([row['age'] for row in profiles_api.apply_filters(rows, {'age': '<21'})], [18])
        self.assertEqual([row['age'] for row in profiles_api.apply_filters(rows, {'age': '21-25'})], [21, 25])
        self.assertEqual([row['age'] for row in profiles_api.apply_filters(rows, {'age': '>45'})], [46, 98])
        self.assertEqual(profiles_api.apply_filters(rows, {'age': 'not-an-age-bucket'}), [])

    def test_dataset_answer_counts_are_cached_without_caching_filtered_rows(self):
        class CountingRows(list):
            iterations = 0

            def __iter__(self):
                self.iterations += 1
                return super().__iter__()

        rows = CountingRows([{'gender': 'Man'}, {'gender': None}, {'gender': 'Woman'}])
        with patch.object(profiles_api, '_profiles_cache', rows):
            self.assertEqual(profiles_api.count_non_blank(rows, 'gender'), 2)
            self.assertEqual(rows.iterations, 1)
            self.assertEqual(profiles_api.count_non_blank(rows, 'gender'), 2)
            self.assertEqual(rows.iterations, 1)
            filtered = rows[:1]
            self.assertEqual(profiles_api.count_non_blank(filtered, 'gender'), 1)
        replacement = CountingRows([{'gender': 'Man'}])
        with patch.object(profiles_api, '_profiles_cache', replacement):
            self.assertEqual(profiles_api.count_non_blank(replacement, 'gender'), 1)
            self.assertEqual(replacement.iterations, 1)

    def test_height_answer_count_uses_normalized_numeric_field(self):
        rows = [
            {'height_inches': 60, 'height_bucket': '5\'0"-5\'3"'},
            {'height_inches': None, 'height_bucket': None},
        ]
        self.assertEqual(profiles_api.count_non_blank(rows, 'height'), 1)

    def test_indexed_filters_match_existing_scan(self):
        rows = [
            {'age': 21, 'gender': 'Man', 'height_inches': 36, 'politics': 'Liberal'},
            {'age': 25, 'gender': 'Woman', 'height_inches': 60, 'politics': 'Moderate'},
            {'age': 30, 'gender': 'Non-binary/Gender Nonconforming', 'height_inches': 70, 'politics': None},
            {'age': None, 'gender': 'Non-binary/Gender Nonconforming', 'height_inches': None, 'politics': 'Liberal'},
        ]
        filters_list = [
            {'age': ['21-25', '25']},
            {'height': ["3'0\"", "5'0\"-5'3\""]},
            {'gender': ['Man', 'Non-binary/Gender Nonconforming']},
            {'gender': ['WOMAN'], 'politics': ['moderate']},
            {'age': ['>20'], 'height': ["<5'8\""]},
            {'politics': ['not present']},
            {'gender': 'Man'},
            {'age': []},
        ]
        for filters in filters_list:
            with self.subTest(filters=filters):
                expected = profiles_api.apply_filters(rows, filters)
                with patch.object(profiles_api, '_profiles_cache', rows):
                    actual = profiles_api.apply_filters(rows, filters)
                self.assertEqual(actual, expected)


if __name__ == '__main__':
    unittest.main()